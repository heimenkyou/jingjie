import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from migrate_to_sqlite import migrate


class Cursor:
    """模拟快照游标，验证迁移时的数据完整性。"""

    def __init__(self, tables):
        self.tables = tables
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql):
        self.rows = list(self.tables[sql.split(' FROM ')[1].split()[0]])

    def fetchmany(self, size):
        rows, self.rows = self.rows[:size], self.rows[size:]
        return rows


class Source:
    def __init__(self, tables):
        self.tables = tables

    def cursor(self):
        return Cursor(self.tables)


class MigrationTest(unittest.TestCase):
    """验证历史数据和已有目标文件的保护。"""

    def test_copies_all_rows_and_generated_page(self):
        tables = {
            'analytics_events': [(7, 'page_show', 'install', 'session', 'v1', 'android', 1, '{"page":"/pages/viewer/index"}', '2026-01-02 03:04:05.000')],
            'feedback_items': [(3, '反馈', '联系方式', 'v1', '2026-01-02 03:04:05.000')],
            'download_statistics': [(1, 234, '2026-01-02 03:04:05.000')],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'analytics.db'
            self.assertEqual(migrate(Source(tables), path), {key: 1 for key in tables})
            with closing(sqlite3.connect(path)) as db:
                self.assertEqual(db.execute('SELECT id, page_path FROM analytics_events').fetchone(), (7, '/pages/viewer/index'))
                self.assertEqual(db.execute('SELECT content, contact FROM feedback_items').fetchone(), ('反馈', '联系方式'))
                self.assertEqual(db.execute('SELECT total_downloads FROM download_statistics').fetchone()[0], 234)

    def test_existing_file_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'analytics.db'
            path.write_bytes(b'existing')
            with self.assertRaises(FileExistsError):
                migrate(Source({}), path)
            self.assertEqual(path.read_bytes(), b'existing')

    def test_failed_migration_removes_new_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'analytics.db'
            with self.assertRaises(KeyError):
                migrate(Source({}), path)
            self.assertFalse(path.exists())
