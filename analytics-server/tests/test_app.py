import unittest

from app import app, parse_date_range, validate_event


VALID_EVENT = {
    'event': 'page_show',
    'installId': 'c41e0bd2-7ca4-4d2c-aec5-a1af13a0f991',
    'sessionId': 'b26f690f-5951-4a88-bbda-a761018df1ed',
    'appVersion': 'v2.2.0',
    'platform': 'android',
    'timestamp': 1780000000000,
    'properties': {'page': '/pages/viewer/index'},
}


class ValidateEventTest(unittest.TestCase):
    """验证统计事件字段限制。"""

    def test_accepts_documented_page_event(self):
        event, error = validate_event(VALID_EVENT)

        self.assertIsNone(error)
        self.assertEqual(event['event'], 'page_show')

    def test_rejects_unknown_property(self):
        payload = {
            **VALID_EVENT,
            'properties': {'page': '/pages/viewer/index', 'content': '不应存储'},
        }

        event, error = validate_event(payload)

        self.assertIsNone(event)
        self.assertEqual(error, 'properties 字段不符合事件定义')

    def test_rejects_oversized_date_range(self):
        start, end, error = parse_date_range('2026-01-01', '2026-02-02')

        self.assertIsNone(start)
        self.assertIsNone(end)
        self.assertEqual(error, '查询日期范围必须在 31 天内')

    def test_track_route_rejects_invalid_event_without_database_access(self):
        response = app.test_client().post('/api/jingjie-track', json={'event': 'unknown'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json, {'error': '不支持的事件名'})
