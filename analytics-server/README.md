# 净界统计服务

轻量 Flask 服务，将客户端统计事件、下载次数和用户反馈写入 MySQL 8.0+，并提供受令牌保护的管理查询接口。

## 初始化

```bash
cd analytics-server
uv sync
```

复制 `.env.example` 为 `.env`，填写 MySQL 连接信息。`.env` 已被 Git 忽略。

使用具有建库权限的 MySQL 账号执行初始化脚本：

```bash
mysql -u root -p < sql/init.sql
```

为运行账号授权时，数据库名需要与 `.env` 中的 `MYSQL_DATABASE` 一致：

```sql
CREATE USER 'jingjie_analytics'@'127.0.0.1' IDENTIFIED BY '请设置强密码';
GRANT SELECT, INSERT ON jingjie_analytics.* TO 'jingjie_analytics'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## 运行

本地调试：

```bash
uv run python app.py
```

Linux 生产环境：

```bash
uv run gunicorn --workers 1 --threads 1 --bind 127.0.0.1:8000 app:app
```

使用 systemd 部署时，将 [`deploy/jingjie-analytics.service`](deploy/jingjie-analytics.service) 复制到 `/etc/systemd/system/`，再执行 `systemctl daemon-reload` 与 `systemctl enable --now jingjie-analytics`。

默认监听 `127.0.0.1:8000`。生产环境保持 `FLASK_DEBUG=false`，通过反向代理将 `https://jingjie.luowb.cn/api/` 转发到本服务。

## 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/healthz` | 检查服务与 MySQL 连通性 |
| `POST` | `/api/jingjie-track` | 写入客户端统计事件 |
| `GET` | `/api/admin/analytics/daily` | 查询按日 PV、UV |
| `GET` | `/api/admin/analytics/pages` | 查询按页面 PV、UV |
| `GET` | `/api/downloads` | 查询累计下载次数 |
| `POST` | `/api/downloads` | 增加下载次数 |
| `POST` | `/api/feedback` | 提交反馈 |
| `GET` | `/api/admin/feedback` | 查询最新反馈 |

事件请求格式、字段限制和统计口径见项目根目录的 [`docs/analytics-api.md`](../docs/analytics-api.md)。

成功写入事件返回 HTTP `204 No Content`。无效字段返回 `400`，非 JSON 请求返回 `415`，数据库不可用返回 `503`。

统计查询接口需要在请求头中携带 `.env` 的 `ANALYTICS_ADMIN_TOKEN`：

```http
Authorization: Bearer <ANALYTICS_ADMIN_TOKEN>
```

查询参数 `start` 与 `end` 均为 `YYYY-MM-DD`，日期范围最多 31 天。日统计可选 `event` 参数，默认统计 `page_show`：

```text
GET /api/admin/analytics/daily?start=2026-09-01&end=2026-09-05&event=page_show
GET /api/admin/analytics/pages?start=2026-09-01&end=2026-09-05
```
