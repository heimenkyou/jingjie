# 统计接口

## 概述

客户端通过 `POST https://jingjie.luowb.cn/api/jingjie-track` 异步提交事件。接口失败不能影响应用功能，客户端不重试。

请求头：

```http
Content-Type: application/json
```

## 请求体

```json
{
  "event": "page_show",
  "installId": "c41e0bd2-7ca4-4d2c-aec5-a1af13a0f991",
  "sessionId": "b26f690f-5951-4a88-bbda-a761018df1ed",
  "appVersion": "v2.2.0",
  "platform": "android",
  "timestamp": 1780000000000,
  "properties": {
    "page": "/pages/viewer/index"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `event` | string | 是 | 白名单中的事件名 |
| `installId` | string | 是 | 客户端首次启动时生成的随机安装标识，用于 UV 去重 |
| `sessionId` | string | 是 | 每次应用启动生成的随机会话标识 |
| `appVersion` | string | 是 | 应用版本号 |
| `platform` | string | 是 | 当前运行平台，例如 `android` |
| `timestamp` | number | 是 | 客户端 Unix 毫秒时间戳 |
| `properties` | object | 是 | 事件附加属性 |

后端以接收时间作为统计日期，避免客户端时间被修改导致跨日数据错误。

## 事件白名单

| 事件名 | 触发时机 | `properties` |
| --- | --- | --- |
| `app_launch` | 应用启动 | `{}` |
| `page_show` | 页面每次展示 | `{ "page": "/pages/..." }` |
| `barcode_add` | 条码保存成功 | `{}` |
| `station_open_identity_code` | 请求打开淘宝身份码 | `{}` |
| `station_open_home` | 请求打开淘宝驿站页 | `{}` |
| `feedback_submit` | 反馈提交成功 | `{}` |

## 响应

接口成功时返回 HTTP `204 No Content`，也可返回以下 JSON：

```json
{
  "success": true
}
```

客户端不依赖响应体。

## 管理查询接口

以下接口由 `analytics-server` 提供，必须携带请求头：

```http
Authorization: Bearer <ANALYTICS_ADMIN_TOKEN>
```

`start` 与 `end` 均为 `YYYY-MM-DD`，最多查询 31 天。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/analytics/daily?start=2026-09-01&end=2026-09-05&event=page_show` | 按日查询指定事件的 PV、UV，`event` 默认值为 `page_show` |
| `GET` | `/api/admin/analytics/pages?start=2026-09-01&end=2026-09-05` | 查询范围内各页面的 PV、UV |

日统计响应示例：

```json
{
  "event": "page_show",
  "start": "2026-09-01",
  "end": "2026-09-05",
  "days": [
    {
      "day": "2026-09-01",
      "pv": 128,
      "uv": 73
    }
  ]
}
```

## 服务端校验

- 仅接受 `POST` 与 JSON 请求体。
- 校验事件名属于白名单。
- 限制 `installId`、`sessionId` 长度为 36 字符，`appVersion` 不超过 32 字符。
- `properties` 仅保留白名单字段；`page_show` 仅允许 `page`，长度不超过 128 字符。
- 拒绝携带条码图片、反馈内容、联系方式、设备硬件标识等数据。

## 统计口径

- PV：指定时间范围内事件总数。页面 PV 使用 `event = 'page_show'`。
- UV：指定自然日内 `installId` 去重数。一个应用重装后会生成新的安装标识。
- 启动次数：`event = 'app_launch'` 的事件数。
- 页面访问：按 `page_show.properties.page` 分组统计 PV 与 UV。
