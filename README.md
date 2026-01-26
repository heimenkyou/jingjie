# 我要喝水吹头发 💧💨

<div align="center">

**一款极简、快速的校园条码管理工具**

*把被广告和层层菜单偷走的时间抢回来*

[![Uni-app](https://img.shields.io/badge/Framework-Uni--app-brightgreen)](https://uniapp.dcloud.io/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-green)](https://vuejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

</div>

---

## 📖 项目背景

这款应用诞生于对校园生活的深度观察：

### 😤 现状痛点

- **校园原版应用"多彩校园"**：启动慢、强制弹窗广告、关闭按钮极小
- **操作繁琐**：条码需要手动展开，每次使用都要重复多个步骤
- **体验糟糕**：广告加载时间甚至比使用时间还长

### 🔍 替代方案的局限

虽然可以使用**相册截图**来替代：
- ✗ 相册查找慢
- ✗ 有应用锁需要解锁
- ✗ **最关键**：截图无法像原版应用那样**自动调高屏幕亮度**，导致扫码失败率高

### 🚀 本应用使命

**实现"开箱即用"**
- ✅ 点开即是条码
- ✅ 自动调至最高亮度
- ✅ 左右滑动快速切换
- ✅ 零广告、零等待

---

## ✨ 功能特性

### 🎯 核心功能

| 功能 | 说明 |
|------|------|
| 📱 **条码展示** | 全屏显示，支持多条码左右滑动切换 |
| ☀️ **自动亮度** | 打开页面自动调至最高亮度，无需手动调节 |
| 🎨 **清新主题** | 清新绿 + 现代蓝渐变配色，视觉舒适 |
| 🔖 **默认条码** | 设置默认开屏条码，每次打开优先显示 |
| 📝 **条码管理** | 添加、删除、重命名条码，简单直观 |
| 💾 **本地存储** | 数据保存在本地，无需网络，隐私安全 |
| 🎭 **空状态引导** | 首次使用时友好的引导流程 |

### 🎁 额外亮点

- **极速启动**：纯原生组件，无第三方库，启动速度快
- **隐私保护**：完全离线，所有数据仅存储在本地
- **操作简单**：三步完成设置，老少皆宜
- **UI设计**：现代化UI设计，精致美观

---

## 🛠️ 技术栈

- **框架**：[Uni-app](https://uniapp.dcloud.io/) (Vue 3 Composition API)
- **平台**：Android
- **存储**：LocalStorage（本地持久化）
- **图片处理**：Base64 编码（APP）/ 临时路径（H5）
- **样式**：原生 CSS

### 核心 API 使用

```javascript
// 图片选择与上传
uni.chooseImage()

// 文件系统操作（Android）
plus.io.resolveLocalFileSystemURL()

// 屏幕亮度控制
uni.setScreenBrightness({ value: 1 })

// 本地数据存储
uni.getStorageSync('barcodes')
uni.setStorageSync('barcodes', data)
```

---

## 🚀 快速开始

### 环境要求

- Node.js 14+
- HBuilderX（推荐）或 其他支持 Uni-app 的开发工具

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/heimenkyou/water-hair.git
   cd water-hair
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **运行项目**
   
   - **方式一**：使用 HBuilderX
     - 打开 HBuilderX
     - 导入项目
     - 运行 → 运行到手机或模拟器 → Android App

   - **方式二**：命令行（需配置环境）
     ```bash
     npm run dev:app-android
     ```

4. **打包发布**
   
   - 打开 HBuilderX
   - 导入项目
   - 发行 → App-Android/iOS-云打包

---

## 📱 使用说明

### 第一次使用

1. **安装应用**后首次打开
2. 阅读并同意**隐私政策说明**
3. 查看**空状态引导卡片**，了解使用流程

### 添加条码

1. 前往**多彩校园**截取饮水机或吹风机的条码
   > 💡 建议先展开条码再截图，确保图片清晰
2. 点击应用底部的**"设置"**标签
3. 点击**"+ 添加条码"**按钮
4. 从相册选择刚才截取的条码图片
5. 上传成功！可为条码自定义名称

### 设置默认条码

1. 在**设置页面**，找到想要设为默认的条码
2. 点击条码**左上角的圆形单选框**
3. 系统提示"已设为默认"
4. 下次打开应用会优先显示该条码

### 日常使用

1. 口渴或需要吹头时，**直接打开应用**
2. 应用自动调至**最高亮度**
3. 将手机对准扫码器即可
4. 如有多个条码，**左右滑动**切换

---

## 📂 项目结构

```
我要喝水吹头发/
├── pages/                      # 页面文件
│   ├── viewer/                 # 条码展示页
│   │   └── index.vue
│   └── settings/               # 设置管理页
│       └── index.vue
├── static/                     # 静态资源
│   └── logo.png
├── androidPrivacy.json         # Android 隐私政策配置
├── pages.json                  # 页面配置
├── manifest.json               # 应用配置
├── App.vue                     # 根组件
├── main.js                     # 入口文件
└── README.md                   # 项目说明
```

---

## 🎨 界面预览

### 条码展示页
- 全屏黑色背景，突出条码显示
- 底部显示条码名称
- 自动亮度提示："✨ 已为您自动调整至最高亮度"

### 设置管理页
- 清新绿渐变头部
- 条码列表卡片式展示
- 左上角单选框设置默认条码
- "关于本项目"板块

### 空状态引导
- 三步走引导流程
- 清晰的操作指引

---

## 💡 设计理念

1. **极简主义**：去除一切不必要的功能，专注核心需求
2. **用户友好**：操作简单直观，无需学习成本
3. **性能优先**：使用原生组件，启动速度快
4. **隐私安全**：完全离线，不收集任何用户数据

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 👨‍💻 开发者

**👤 罗文彬** + **🤖 Claude 4.5** = **🚀 极速体验**

> *"我厌倦了等待广告，于是和 AI 聊了一个下午，做出了这个应用。"*

### 联系方式

- **QQ**: 3209871721
- **邮箱**: wenbin.lo@outlook.com

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议

---

## ⭐ Star History

如果这个项目对您有帮助，请给个 Star ⭐️ 支持一下！

---

<div align="center">

**Made with ❤️ for a better campus life**

</div>
