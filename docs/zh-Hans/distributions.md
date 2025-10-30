# 发行版

Yuan 是一个功能强大的操作系统，但它也太过于底层、原始和难用，只有极客型用户可以玩转，不适合直接给普通用户使用。

针对不同的用户场景，最好提供特定的发行版，预先配置好一些功能，以便用户可以直接使用。

以下，是我们提供的一些发行版，作为参考。您可以根据自己的需求，创建自己的发行版。

## 官方发行版

### [@yuants/dist-origin](./packages/yuants-dist-origin.md): 原生发行版

[点击在线体验](https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin)

原生发行版提供了 Yuan 系统的完整功能，适合开发者和高级用户使用。

## 创建发行版

发行版的本质是一个工作区，工作区的本质是一个文件目录及其中的内容。我们可以将工作区打包成一个发行版，然后用户可以下载并解压缩，即可使用。我们推荐使用 npm 包管理工具来管理发行版，即发行版会发布到 npm 仓库，用户可以通过 npm 安装发行版。

### 发行版特点

- **预配置**: 预先配置好常用功能和服务
- **易用性**: 降低使用门槛，适合特定用户群体
- **专业化**: 针对特定场景优化配置
- **可定制**: 基于现有发行版进行二次开发

### 创建步骤

1. **创建工作区**: 创建一个包含所需配置和文件的工作区目录
2. **配置功能**: 根据目标用户需求配置相应的功能和服务
3. **打包发布**: 将工作区打包并发布到 npm 仓库
4. **文档编写**: 提供详细的使用说明和配置指南

## 安装发行版

在 Web GUI 的地址参数中，我们可以通过 `from_npm` 参数来指定从 npm 安装发行版。例如，`https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin`。

### URL 参数

- `from_npm`: 是否从 npm 安装发行版。`1` 为是，留空为否。
- `scope`: npm 包的 scope，可选参数。
- `name`: npm 包的名称，必选参数。
- `version`: npm 包的版本，格式符合 [semver](https://semver.org/) 规范的版本号范围，可选参数。默认为最新版本。

### 安装示例

```
// 安装 @yuants/dist-origin 发行版的最新版本
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin

// 安装 @yuants/dist-origin 发行版的特定版本 (0.0.2)
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=0.0.2

// 安装 @yuants/dist-origin 发行版的特定版本 (>=0.0.2)
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=>=0.0.2
```

## 发行版类型

### 基础发行版

- 提供核心功能
- 适合开发者和高级用户
- 高度可定制

### 专业发行版

- 针对特定交易策略优化
- 预配置专业工具
- 适合专业交易者

### 入门发行版

- 简化配置和操作
- 提供向导式设置
- 适合初学者使用

### 企业发行版

- 包含企业级功能
- 支持团队协作
- 提供专业支持

## 优势特点

- **快速启动**: 预配置环境，快速投入使用
- **专业优化**: 针对特定场景深度优化
- **社区贡献**: 鼓励社区创建和分享发行版
- **持续更新**: 官方维护，定期更新

<p align="right">(<a href="../../README.md">返回 README</a>) | <a href="architecture-overview.md">架构概述</a></p>
