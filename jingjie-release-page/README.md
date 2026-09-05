# 净界发布页

净界 (JingJie) 的 APK 分发落地页，使用 Vue 3、Vite 和 Tailwind CSS 构建。

## 功能

- 提供 Android APK 直接下载入口
- 展示 GitHub / Gitee 源码链接
- 简要说明净界的核心功能
- 移动端优先，适合手机打开后直接下载
- `/feedback` 查看反馈列表
- `/analytics` 查看统计数据，需要输入后端的 `ANALYTICS_ADMIN_TOKEN`

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

构建产物输出到 `dist`。
