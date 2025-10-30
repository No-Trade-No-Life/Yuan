# Yuan WebPilot Chrome 扩展

一个功能强大的 Chrome 浏览器扩展，支持内容脚本注入、网络请求监控和可配置的主机地址。

## 功能特性

### 🎯 内容脚本注入

- 自动注入到所有网站
- 提取页面数据（标题、链接、图片、表单等）
- 支持自定义样式注入
- 实时页面变化监控

### 📡 网络请求监控

- 监控所有 HTTP/HTTPS 请求
- 记录请求和响应信息
- 可配置的监控开关
- 请求数据存储和分析

### ⚙️ 可配置界面

- 弹窗界面配置主机地址
- 功能开关控制
- 实时状态显示
- 请求统计信息

## 项目结构

```
ui/webpilot/
├── src/
│   ├── background/          # 后台脚本
│   │   └── background.ts    # 网络请求监控和消息处理
│   ├── content/             # 内容脚本
│   │   └── content.ts       # 网页内容注入和数据提取
│   ├── popup/               # 弹窗界面
│   │   ├── popup.html       # 弹窗 HTML
│   │   └── popup.tsx        # React 弹窗组件
│   ├── shared/              # 共享代码
│   │   └── types.ts         # TypeScript 类型定义
│   └── storage/             # 存储管理
│       └── storage.ts       # Chrome 存储 API 封装
├── public/
│   ├── manifest.json        # Chrome 扩展清单
│   └── icons/               # 扩展图标
├── dist/                    # 构建输出目录
└── scripts/
    └── build.js             # 构建脚本
```

## 安装和使用

### 开发环境

1. **安装依赖**

   ```bash
   cd ui/webpilot
   npm install
   ```

2. **构建项目**

   ```bash
   npm run build
   ```

3. **加载扩展**
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `ui/webpilot/dist` 目录

### 生产环境

1. **构建项目**

   ```bash
   npm run build
   ```

2. **打包扩展**
   - 在 Chrome 扩展管理页面
   - 点击"打包扩展程序"
   - 选择 `ui/webpilot/dist` 目录
   - 生成 `.crx` 文件用于分发

## 配置说明

### 主机地址配置

在弹窗界面中可以配置目标服务器地址，用于接收提取的数据：

- 默认地址：`http://localhost:3000`
- 支持 HTTP/HTTPS 协议

### 功能开关

- **启用扩展**: 控制整个扩展的启用状态
- **网络请求监控**: 监控和记录网络请求
- **内容脚本注入**: 在网页中注入内容脚本

## API 接口

### 内容脚本消息类型

- `PAGE_LOADED`: 页面加载完成
- `DATA_EXTRACTED`: 数据提取完成

### 后台脚本功能

- 网络请求监听 (`webRequest` API)
- 跨标签页通信
- 数据存储管理

## 开发指南

### 添加新功能

1. **扩展类型定义**

   - 在 `src/shared/types.ts` 中添加新的类型定义

2. **实现功能模块**

   - 后台脚本：`src/background/background.ts`
   - 内容脚本：`src/content/content.ts`
   - 弹窗界面：`src/popup/popup.tsx`

3. **更新配置**
   - 修改 `public/manifest.json` 添加权限
   - 更新存储管理逻辑

### 调试技巧

1. **后台脚本调试**

   - 在 Chrome 扩展管理页面点击"背景页"
   - 查看控制台输出

2. **内容脚本调试**

   - 在网页中打开开发者工具
   - 查看控制台输出

3. **弹窗调试**
   - 右键点击扩展图标
   - 选择"检查弹出内容"

## 技术栈

- **语言**: TypeScript
- **构建工具**: Vite
- **UI 框架**: React
- **存储**: Chrome Storage API
- **通信**: Chrome Runtime API

## 许可证

本项目遵循 Yuan 项目的许可证协议。
