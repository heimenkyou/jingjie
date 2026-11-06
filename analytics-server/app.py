import json
import logging
import os
import re
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import date, timedelta
from hmac import compare_digest
from pathlib import Path
from typing import Any

from flask import Flask, g, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge


ENV_FILE = Path(__file__).with_name('.env')
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.IGNORECASE)
EVENT_PROPERTIES = {
    'app_launch': set(),
    'page_show': {'page'},
    'barcode_add': set(),
    'station_open_identity_code': set(),
    'station_open_home': set(),
    'feedback_submit': set(),
    'app_error': {'message'},
    'update_download': {'source'},
    'update_install': set(),
}
APP_ERROR_MESSAGE_LIMIT = 1000
PAGE_PATHS = {
    '/pages/viewer/index',
    '/pages/station/index',
    '/pages/settings/index',
    '/pages/share/index',
}


def load_env_file(path: Path) -> None:
    """读取本地 .env，便于服务以单个进程运行。"""
    if not path.is_file():
        return

    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"\'')
        if key:
            os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    debug: bool
    mysql_host: str
    mysql_port: int
    mysql_database: str
    mysql_user: str
    mysql_password: str
    admin_token: str
    sqlite_path: str

    @classmethod
    def from_env(cls) -> 'Settings':
        """从环境变量读取服务与数据库连接配置。"""
        return cls(
            host=os.getenv('FLASK_HOST', '127.0.0.1'),
            port=int(os.getenv('FLASK_PORT', '8000')),
            debug=os.getenv('FLASK_DEBUG', '').lower() == 'true',
            mysql_host=os.getenv('MYSQL_HOST', '127.0.0.1'),
            mysql_port=int(os.getenv('MYSQL_PORT', '3306')),
            mysql_database=os.getenv('MYSQL_DATABASE', 'jingjie_analytics'),
            mysql_user=os.getenv('MYSQL_USER', 'jingjie_analytics'),
            mysql_password=os.getenv('MYSQL_PASSWORD', ''),
            admin_token=os.getenv('ANALYTICS_ADMIN_TOKEN', ''),
            sqlite_path=os.getenv('SQLITE_PATH', str(Path(__file__).with_name('data') / 'analytics.sqlite3')),
        )


def get_connection(settings: Settings) -> sqlite3.Connection:
    """每个请求独立使用连接，避免跨线程共享。"""
    connection = g.get('analytics_db')
    if connection is None:
        connection = sqlite3.connect(f'{Path(settings.sqlite_path).resolve().as_uri()}?mode=rw', uri=True, timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        g.analytics_db = connection
    return connection


def initialize_database(path: Path) -> None:
    """首次启动时创建数据库；已有文件保持不变。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open('xb'):
            pass
    except FileExistsError:
        return
    try:
        schema = Path(__file__).with_name('sql').joinpath('sqlite.sql').read_text(encoding='utf-8')
        with closing(sqlite3.connect(path)) as connection, connection:
            connection.executescript(schema)
            connection.execute('INSERT INTO download_statistics (id, total_downloads) VALUES (1, 0)')
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def close_connection(_: BaseException | None = None) -> None:
    """在响应完成后释放请求期间创建的数据库连接。"""
    connection = g.pop('analytics_db', None)
    if connection is not None:
        connection.close()


def validate_event(payload: Any) -> tuple[dict[str, Any] | None, str | None]:
    """只接收已定义字段，防止统计接口保存无关数据。"""
    if not isinstance(payload, dict):
        return None, '请求体必须是 JSON 对象'

    event = payload.get('event')
    if event not in EVENT_PROPERTIES:
        return None, '不支持的事件名'

    for field, limit in (('installId', 36), ('sessionId', 36), ('appVersion', 32), ('platform', 16)):
        value = payload.get(field)
        if not isinstance(value, str) or not value or len(value) > limit:
            return None, f'{field} 格式错误'

    if not UUID_PATTERN.fullmatch(payload['installId']) or not UUID_PATTERN.fullmatch(payload['sessionId']):
        return None, '安装标识或会话标识格式错误'

    timestamp = payload.get('timestamp')
    if isinstance(timestamp, bool) or not isinstance(timestamp, int) or timestamp < 0:
        return None, 'timestamp 格式错误'

    properties = payload.get('properties')
    if not isinstance(properties, dict) or set(properties) != EVENT_PROPERTIES[event]:
        return None, 'properties 字段不符合事件定义'

    if event == 'page_show' and properties.get('page') not in PAGE_PATHS:
        return None, 'page 路径不受支持'

    if event == 'app_error':
        message = properties.get('message')
        if not isinstance(message, str) or not message.strip() or len(message) > APP_ERROR_MESSAGE_LIMIT:
            return None, 'message 字段格式错误'

    if event == 'update_download' and properties.get('source') not in ('website', 'inapp'):
        return None, 'source 字段格式错误'

    return {
        'event': event,
        'install_id': payload['installId'],
        'session_id': payload['sessionId'],
        'app_version': payload['appVersion'],
        'platform': payload['platform'],
        'client_timestamp': timestamp,
        'properties': json.dumps(properties, ensure_ascii=False, separators=(',', ':')),
    }, None


def validate_feedback(payload: Any) -> tuple[dict[str, str] | None, str | None]:
    """校验反馈内容，避免写入超长或非文本数据。"""
    if not isinstance(payload, dict):
        return None, '请求体必须是 JSON 对象'

    content = payload.get('content')
    contact = payload.get('contact', '')
    app_version = payload.get('version')
    if not isinstance(content, str) or not 1 <= len(content.strip()) <= 500:
        return None, '反馈内容长度必须在 1 至 500 字符之间'
    if not isinstance(contact, str) or len(contact) > 128:
        return None, '联系方式格式错误'
    if not isinstance(app_version, str) or not app_version or len(app_version) > 32:
        return None, '版本号格式错误'

    return {
        'content': content.strip(),
        'contact': contact.strip(),
        'app_version': app_version,
    }, None


def parse_date_range(start: str | None, end: str | None) -> tuple[date | None, date | None, str | None]:
    """限制查询范围，避免统计查询扫描过多历史数据。"""
    try:
        start_date = date.fromisoformat(start or '')
        end_date = date.fromisoformat(end or '')
    except ValueError:
        return None, None, 'start 与 end 必须为 YYYY-MM-DD'

    if end_date < start_date or (end_date - start_date).days > 31:
        return None, None, '查询日期范围必须在 31 天内'

    return start_date, end_date, None


def create_app() -> Flask:
    """创建统计服务应用。"""
    load_env_file(ENV_FILE)
    settings = Settings.from_env()
    initialize_database(Path(settings.sqlite_path))
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 8 * 1024
    app.teardown_appcontext(close_connection)

    @app.errorhandler(RequestEntityTooLarge)
    def handle_request_too_large(_: RequestEntityTooLarge):
        return jsonify(error='请求体不能超过 8 KB'), 413

    @app.get('/api/healthz')
    def healthz():
        """检查服务与数据库连接状态。"""
        try:
            get_connection(settings).execute('SELECT 1')
            return jsonify(status='ok')
        except sqlite3.Error:
            app.logger.exception('健康检查数据库连接失败')
            return jsonify(error='数据库不可用'), 503

    @app.post('/api/jingjie-track')
    def track_event():
        """写入一条经过字段校验的客户端统计事件。"""
        if not request.is_json:
            return jsonify(error='请求类型必须是 application/json'), 415

        event, error = validate_event(request.get_json(silent=True))
        if error:
            return jsonify(error=error), 400

        try:
            get_connection(settings).execute(
                    '''
                    INSERT INTO analytics_events (
                        event_name, install_id, session_id, app_version,
                        platform, client_timestamp, properties
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        event['event'],
                        event['install_id'],
                        event['session_id'],
                        event['app_version'],
                        event['platform'],
                        event['client_timestamp'],
                        event['properties'],
                    ),
                )
        except sqlite3.Error:
            app.logger.exception('统计事件写入失败')
            return jsonify(error='数据库不可用'), 503

        return '', 204

    @app.get('/api/downloads')
    def get_download_count():
        """返回当前累计下载次数。"""
        try:
            row = get_connection(settings).execute('SELECT total_downloads FROM download_statistics WHERE id = 1').fetchone()
        except sqlite3.Error:
            app.logger.exception('下载量查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(count=row['total_downloads'] if row else 0)

    @app.post('/api/downloads')
    def increment_download_count():
        """记录一次下载请求并返回更新后的累计次数。"""
        try:
            row = get_connection(settings).execute(
                "UPDATE download_statistics SET total_downloads = total_downloads + 1, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime') WHERE id = 1 RETURNING total_downloads"
            ).fetchone()
        except sqlite3.Error:
            app.logger.exception('下载量写入失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(count=row['total_downloads'] if row else 0)

    @app.post('/api/feedback')
    def submit_feedback():
        """保存用户主动提交的反馈。"""
        if not request.is_json:
            return jsonify(error='请求类型必须是 application/json'), 415

        feedback, error = validate_feedback(request.get_json(silent=True))
        if error:
            return jsonify(error=error), 400

        try:
            get_connection(settings).execute(
                    'INSERT INTO feedback_items (content, contact, app_version) VALUES (?, ?, ?)',
                    (feedback['content'], feedback['contact'], feedback['app_version']),
                )
        except sqlite3.Error:
            app.logger.exception('反馈写入失败')
            return jsonify(error='数据库不可用'), 503

        return '', 204

    def require_admin_token():
        """限制统计查询接口，避免访问数据聚合结果。"""
        authorization = request.headers.get('Authorization', '')
        expected = f'Bearer {settings.admin_token}'
        if not settings.admin_token or not compare_digest(authorization, expected):
            return jsonify(error='未授权'), 401
        return None

    @app.get('/api/admin/feedback')
    def list_feedback():
        """返回最新反馈，仅供管理页面查看。"""
        unauthorized = require_admin_token()
        if unauthorized:
            return unauthorized

        try:
            rows = get_connection(settings).execute(
                    '''
                    SELECT content, contact, app_version, created_at
                    FROM feedback_items
                    ORDER BY id DESC
                    LIMIT 100
                    '''
            ).fetchall()
        except sqlite3.Error:
            app.logger.exception('反馈查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify([
            {
                'content': row['content'],
                'contact': row['contact'],
                'version': row['app_version'],
                'timestamp': row['created_at'][:19],
            }
            for row in rows
        ])

    @app.get('/api/admin/analytics/daily')
    def daily_analytics():
        """按日返回指定事件的 PV 与 UV。"""
        unauthorized = require_admin_token()
        if unauthorized:
            return unauthorized

        start_date, end_date, error = parse_date_range(request.args.get('start'), request.args.get('end'))
        if error:
            return jsonify(error=error), 400

        event = request.args.get('event', 'page_show')
        if event not in EVENT_PROPERTIES:
            return jsonify(error='不支持的事件名'), 400

        try:
            rows = get_connection(settings).execute(
                    '''
                    SELECT DATE(created_at) AS day,
                           COUNT(*) AS pv,
                           COUNT(DISTINCT install_id) AS uv
                    FROM analytics_events
                    WHERE created_at >= ?
                      AND created_at < ?
                      AND event_name = ?
                    GROUP BY DATE(created_at)
                    ORDER BY day
                    ''',
                    (start_date.isoformat(), (end_date + timedelta(days=1)).isoformat(), event),
            ).fetchall()
        except sqlite3.Error:
            app.logger.exception('日统计查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(
            event=event,
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            days=[{'day': row['day'], 'pv': row['pv'], 'uv': row['uv']} for row in rows],
        )

    @app.get('/api/admin/analytics/pages')
    def page_analytics():
        """按页面返回访问 PV 与 UV。"""
        unauthorized = require_admin_token()
        if unauthorized:
            return unauthorized

        start_date, end_date, error = parse_date_range(request.args.get('start'), request.args.get('end'))
        if error:
            return jsonify(error=error), 400

        try:
            rows = get_connection(settings).execute(
                    '''
                    SELECT page_path AS page,
                           COUNT(*) AS pv,
                           COUNT(DISTINCT install_id) AS uv
                    FROM analytics_events
                    WHERE created_at >= ?
                      AND created_at < ?
                      AND event_name = 'page_show'
                    GROUP BY page_path
                    ORDER BY pv DESC
                    ''',
                    (start_date.isoformat(), (end_date + timedelta(days=1)).isoformat()),
            ).fetchall()
        except sqlite3.Error:
            app.logger.exception('页面统计查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            pages=[{'page': row['page'], 'pv': row['pv'], 'uv': row['uv']} for row in rows],
        )

    @app.get('/api/admin/analytics/versions')
    def version_analytics():
        """按 app_version 返回活跃设备数与事件数，用于观察版本分布与升级覆盖。"""
        unauthorized = require_admin_token()
        if unauthorized:
            return unauthorized

        start_date, end_date, error = parse_date_range(request.args.get('start'), request.args.get('end'))
        if error:
            return jsonify(error=error), 400

        event = request.args.get('event', 'app_launch')
        if event not in EVENT_PROPERTIES:
            return jsonify(error='不支持的事件名'), 400

        try:
            rows = get_connection(settings).execute(
                    '''
                    SELECT app_version AS version,
                           COUNT(*) AS count,
                           COUNT(DISTINCT install_id) AS devices
                    FROM analytics_events
                    WHERE created_at >= ?
                      AND created_at < ?
                      AND event_name = ?
                    GROUP BY app_version
                    ORDER BY devices DESC
                    ''',
                    (start_date.isoformat(), (end_date + timedelta(days=1)).isoformat(), event),
            ).fetchall()
        except sqlite3.Error:
            app.logger.exception('版本统计查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            event=event,
            versions=[{'version': row['version'], 'count': row['count'], 'devices': row['devices']} for row in rows],
        )

    return app


app = create_app()


def main() -> None:
    """以轻量开发服务器运行应用。"""
    settings = Settings.from_env()
    app.run(host=settings.host, port=settings.port, debug=settings.debug, threaded=False)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
