"""将 MySQL 的一致性快照复制到新的 SQLite 数据库。"""

import argparse
import sqlite3
from contextlib import closing
from pathlib import Path

import pymysql

from app import ENV_FILE, Settings, load_env_file


TABLE_COLUMNS = {
    'analytics_events': ('id', 'event_name', 'install_id', 'session_id', 'app_version', 'platform', 'client_timestamp', 'properties', 'created_at'),
    'feedback_items': ('id', 'content', 'contact', 'app_version', 'created_at'),
    'download_statistics': ('id', 'total_downloads', 'updated_at'),
}


def migrate(source, destination: Path) -> dict[str, int]:
    """迁移快照并核对记录数；目标必须是不存在的新文件。"""
    with destination.open('xb'):
        pass
    try:
        with closing(sqlite3.connect(destination)) as target, target:
            target.executescript(Path(__file__).with_name('sql').joinpath('sqlite.sql').read_text(encoding='utf-8'))
            counts = {}
            for table, columns in TABLE_COLUMNS.items():
                names = ', '.join(columns)
                placeholders = ', '.join('?' for _ in columns)
                with source.cursor() as cursor:
                    cursor.execute(f'SELECT {names} FROM {table} ORDER BY id')
                    count = 0
                    while rows := cursor.fetchmany(1000):
                        target.executemany(f'INSERT INTO {table} ({names}) VALUES ({placeholders})', rows)
                        count += len(rows)
                actual = target.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                if actual != count:
                    raise RuntimeError(f'{table} 记录数校验失败')
                counts[table] = count
            if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('SQLite 完整性校验失败')
        return counts
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def main() -> None:
    """从现有 MySQL 配置读取一致性快照并输出迁移数量。"""
    parser = argparse.ArgumentParser(description='将 MySQL 统计数据复制到新的 SQLite 数据库')
    parser.add_argument('destination', type=Path, help='尚不存在的 SQLite 数据库路径')
    args = parser.parse_args()
    load_env_file(ENV_FILE)
    settings = Settings.from_env()
    source = pymysql.connect(
        host=settings.mysql_host, port=settings.mysql_port, user=settings.mysql_user,
        password=settings.mysql_password, database=settings.mysql_database,
        charset='utf8mb4', autocommit=False, cursorclass=pymysql.cursors.SSCursor,
    )
    try:
        with source.cursor() as cursor:
            cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            cursor.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT')
        counts = migrate(source, args.destination)
        for table, count in counts.items():
            print(f'{table}: {count}')
    finally:
        source.rollback()
        source.close()


if __name__ == '__main__':
    main()
