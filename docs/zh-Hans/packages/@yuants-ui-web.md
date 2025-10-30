# Web UI

这是 https://y.ntnl.io 和 https://y.ntnl.tech 的源代码

## 快速开始 🚀

执行 `rush update` 并运行 `rush build` 构建依赖后，可通过以下命令启动本地开发服务器：

```bash
rushx dev # 必须在 'ui/web' 路径下执行
```

## 模块结构

本工程采用模块化组织，每个模块具有高内聚性，包含 React 组件、RxJS Observables & Subjects、工具函数等。

### 通用模块

需要保证能同时在 主线程 和 Web Worker 中运行的模块，提供核心的 IO 能力：

- [FileSystem](src/modules/FileSystem) 模块提供 Promise 风格的文件系统 API。负责创建和绑定工作区。
- [Network](src/modules/Network) 模块提供连接到主机的相关网络功能，以远程调用其他终端提供的服务。

对于主线程而言，需要首先引导 UI 启动：

- [BIOS](src/modules/BIOS) 模块提供 BIOS 相关功能，提供不同方式的启动引导 (从本地/远程工作区启动)，完成引导后切换到 Workbench UI。
- [Workbench](src/modules/Workbench) 模块提供通用 UI 框架。
- [DesktopLayout](src/modules/DesktopLayout) 模块提供桌面布局，基于 flexlayout-react 支持多页面拖拽布局。
- [Pages](src/modules/Pages) 模块提供与布局无关的页面模型和操作方法。
- [CommandCenter](src/modules/CommandCenter) 模块提供命令注册与执行功能。
- [System](src/modules/System) 模块提供注册关联表等相关功能。
- [Locale](src/modules/Locale) 模块提供国际化支持。
- [Extensions](src/modules/Extensions) 管理扩展功能。

以及我们自身对于 UI 的一些增强：

- [Interactive](src/modules/Interactive) 模块提供交互式 UI 组件。包括如何点击、提示和展示数据。
- [Form](src/modules/Form) 模块将 React JSON Schema Form 接入 Semi UI，提供表单输入功能。
- [Editor](src/modules/Editor) 模块基于 Monaco 提供网页文件编辑器。

以上模块与 Yuan 的业务领域 (量化投资) 无关，提供了基础的 UI 框架和功能，开发者可以基于上述模块开发一个其他领域的 Web 应用。

### 业务模块

- [SQL](src/modules/SQL) 模块提供 SQL 查询数据库的 UI。

数据管理相关:

- [AccountInfo](src/modules/AccountInfo) 处理账户信息
- [AccountComposition](src/modules/AccountComposition) 提供账户组合的 UI
- [AccountRiskInfo](src/modules/AccountRiskInfo) 提供账户风险信息的 UI
- [Order](src/modules/Order) 提供订单管理功能（查看与提交）
- [Products](src/modules/Products) 提供产品查看功能
- [TransferOrder](src/modules/TransferOrder) 提供转账订单的 UI
- [TradeCopier](src/modules/TradeCopier) 提供交易复制器的配置管理
- [DataSeries](src/modules/DataSeries) 提供数据序列的管理功能

其他:

- [Agent](src/modules/Agent) 包含智能体场景的业务逻辑
- [Chart](src/modules/Chart) 基于 [TradingView/lighweight-charts](https://github.com/tradingview/lightweight-charts) 的时间序列图表
- [Copilot](src/modules/Copilot) 提供 AI Copilot 功能
- [DataRecord](src/modules/DataRecord) 提供数据记录的管理功能
- [Deploy](src/modules/Deploy) 提供部署相关功能
- [Fund](src/modules/Fund) 提供资金管理功能，可汇总多账户并计算投资者权益，适用于基金核算
- [Kernel](src/modules/Kernel) 基于 `@yuants/kernel` 构建的场景
- [Market](src/modules/Market) 提供市场数据查看功能
- [Terminals](src/modules/Terminals) 查看终端及其状态

### 国际化与本地化

强烈推荐安装 **Lokalise** 开发的 VSCode 插件：[**i18n Ally**](https://github.com/lokalise/i18n-ally)，请阅读其文档获取最佳体验。

只需配置显示语言 (`i18n-ally.displayLanguage`) 为 `zh`、`en` 等（建议配置在用户设置而非工作区设置）。

所有翻译文件位于 [`public/locales`](public/locales) 目录。

我们推荐使用命名空间组织 i18n 键值，命名空间名称对应 React 组件名。每个导出的 React 组件应有唯一命名空间，文件名称与组件名相同。模块内未导出的小型组件可使用简单名称。

不推荐在键值中重复命名空间前缀：

```ts
// 不推荐
const { t } = useTranslation();
t('SomeComponent_xxx');

// 推荐
const { t } = useTranslation('SomeComponent');
t('xxx');
```

#### 特殊命名空间

保留命名空间：

- `"commands:<id>"` 用于翻译命令显示名称
- `"pages:<id>"` 用于翻译页面标题

### 布局与页面

包含来自不同模块的多个页面：

**页面** 是具有可序列化参数的顶级 React 组件。[页面模块](src/modules/Pages) 提供与布局无关的模型和操作方法。

**布局** 是顶级 React 组件，决定页面渲染方式：

- 大屏使用 [桌面布局](src/modules/DesktopLayout)，基于 [flexlayout-react](https://github.com/caplin/FlexLayout) 支持多页面拖拽布局
- 小屏使用移动布局，单页面显示支持滑动导航

响应式设计建议：

- 大屏用 `<Table />`，小屏用 `<List />`
- 大屏用 `<Modal />` 等弹窗，小屏用独立页面
