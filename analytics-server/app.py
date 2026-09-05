import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import date
from hmac import compare_digest
from pathlib import Path
from typing import Any

import pymysql
from flask import Flask, g, jsonify, request
from pymysql.err import MySQLError
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
}
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
        )


def get_connection(settings: Settings) -> pymysql.Connection:
    """每个请求独立使用一个短连接，避免常驻连接占用资源。"""
    connection = g.get('analytics_db')
    if connection is None:
        connection = pymysql.connect(
            host=settings.mysql_host,
            port=settings.mysql_port,
            user=settings.mysql_user,
            password=settings.mysql_password,
            database=settings.mysql_database,
            charset='utf8mb4',
            autocommit=True,
            connect_timeout=3,
            read_timeout=3,
            write_timeout=3,
            cursorclass=pymysql.cursors.DictCursor,
        )
        g.analytics_db = connection
    return connection


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
            with get_connection(settings).cursor() as cursor:
                cursor.execute('SELECT 1')
            return jsonify(status='ok')
        except MySQLError:
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
            with get_connection(settings).cursor() as cursor:
                cursor.execute(
                    '''
                    INSERT INTO analytics_events (
                        event_name, install_id, session_id, app_version,
                        platform, client_timestamp, properties
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
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
        except MySQLError:
            app.logger.exception('统计事件写入失败')
            return jsonify(error='数据库不可用'), 503

        return '', 204

    @app.get('/api/downloads')
    def get_download_count():
        """返回当前累计下载次数。"""
        try:
            with get_connection(settings).cursor() as cursor:
                cursor.execute('SELECT total_downloads FROM download_statistics WHERE id = 1')
                row = cursor.fetchone()
        except MySQLError:
            app.logger.exception('下载量查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(count=row['total_downloads'] if row else 0)

    @app.post('/api/downloads')
    def increment_download_count():
        """记录一次下载请求并返回更新后的累计次数。"""
        try:
            with get_connection(settings).cursor() as cursor:
                cursor.execute('UPDATE download_statistics SET total_downloads = total_downloads + 1 WHERE id = 1')
                cursor.execute('SELECT total_downloads FROM download_statistics WHERE id = 1')
                row = cursor.fetchone()
        except MySQLError:
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
            with get_connection(settings).cursor() as cursor:
                cursor.execute(
                    'INSERT INTO feedback_items (content, contact, app_version) VALUES (%s, %s, %s)',
                    (feedback['content'], feedback['contact'], feedback['app_version']),
                )
        except MySQLError:
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
            with get_connection(settings).cursor() as cursor:
                cursor.execute(
                    '''
                    SELECT content, contact, app_version, created_at
                    FROM feedback_items
                    ORDER BY id DESC
                    LIMIT 100
                    '''
                )
                rows = cursor.fetchall()
        except MySQLError:
            app.logger.exception('反馈查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify([
            {
                'content': row['content'],
                'contact': row['contact'],
                'version': row['app_version'],
                'timestamp': row['created_at'].strftime('%Y-%m-%d %H:%M:%S'),
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
            with get_connection(settings).cursor() as cursor:
                cursor.execute(
                    '''
                    SELECT DATE(created_at) AS day,
                           COUNT(*) AS pv,
                           COUNT(DISTINCT install_id) AS uv
                    FROM analytics_events
                    WHERE created_at >= %s
                      AND created_at < DATE_ADD(%s, INTERVAL 1 DAY)
                      AND event_name = %s
                    GROUP BY DATE(created_at)
                    ORDER BY day
                    ''',
                    (start_date, end_date, event),
                )
                rows = cursor.fetchall()
        except MySQLError:
            app.logger.exception('日统计查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(
            event=event,
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            days=[{'day': row['day'].isoformat(), 'pv': row['pv'], 'uv': row['uv']} for row in rows],
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
            with get_connection(settings).cursor() as cursor:
                cursor.execute(
                    '''
                    SELECT page_path AS page,
                           COUNT(*) AS pv,
                           COUNT(DISTINCT install_id) AS uv
                    FROM analytics_events
                    WHERE created_at >= %s
                      AND created_at < DATE_ADD(%s, INTERVAL 1 DAY)
                      AND event_name = 'page_show'
                    GROUP BY page_path
                    ORDER BY pv DESC
                    ''',
                    (start_date, end_date),
                )
                rows = cursor.fetchall()
        except MySQLError:
            app.logger.exception('页面统计查询失败')
            return jsonify(error='数据库不可用'), 503

        return jsonify(
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            pages=[{'page': row['page'], 'pv': row['pv'], 'uv': row['uv']} for row in rows],
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
