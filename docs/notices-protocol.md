# 全局公告协议

公告接口使用 `action` 对象描述用户操作，不再支持根据 `link` 字符串猜测页面或写死页面映射。

```json
{
  "schemaVersion": 1,
  "globalEnable": true,
  "pollInterval": 7200,
  "items": [
    {
      "id": "share-feature",
      "content": "邀请好友，一起使用净界",
      "level": "info",
      "allowDismiss": true,
      "action": {
        "type": "navigate",
        "url": "/pages/share/index",
        "label": "去分享"
      }
    }
  ]
}
```

## `action`

`action` 可省略；省略时公告只展示内容。客户端会丢弃格式不合法的动作，不会执行任意 URL 或 API 调用。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 动作类型，见下表 |
| `url` | string | 动作目标 |
| `label` | string，可选 | 详情页按钮文案，默认“前往查看” |

| `type` | 调用的 uni API | `url` 规则 |
| --- | --- | --- |
| `navigate` | `uni.navigateTo` | `/pages/...` 的非 TabBar 页面 |
| `redirect` | `uni.redirectTo` | `/pages/...` 页面 |
| `relaunch` | `uni.reLaunch` | `/pages/...` 页面 |
| `tab` | `uni.switchTab` | `/pages/...` 的 TabBar 页面 |
| `external` | 系统浏览器 | `http://` 或 `https://` URL |

页面跳转方式由公告发布方明确指定，服务端新增页面或动作类型时不需要修改组件中的页面判断。新增动作类型时，必须先在客户端的 `utils/notices.js` 白名单中实现并发布，再使用该类型。
