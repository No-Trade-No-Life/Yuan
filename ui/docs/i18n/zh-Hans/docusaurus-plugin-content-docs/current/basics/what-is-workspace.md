# 工作区

**工作区**是一个集中存储用户数据的**文件目录**。它类似于传统操作系统中的磁盘 (Disk) 概念。

**工作区** 包含了用户的策略、指标、密钥、数据、插件等文件，因此再怎么强调其隐私性也不为过。

**强隐私安全**：工作区中的任何内容都不会被自动上传到云端，除非用户明确地地执行了上传操作。

用户可以在 Yuan GUI 的导航栏的开始菜单中，创建、加载、管理工作区。

## 定制工作区

工作区的内容会在 Yuan GUI 启动时被加载，因此用户可以在工作区中存储自己的偏好设置、插件、应用程序等。

例如，用户可以通过切换工作区来切换不同的系统，类似在电脑中安装双系统一样。例如，区分个人工作区和团队工作区。

用户可以像定制个人操作系统一样定制自己的工作区，包括但不限于：

- 定制主题、桌面、壁纸
- 定制插件、应用程序
- 安装第三方发行版、插件、应用程序

:::warning

安装第三方发行版、插件、应用程序可能会带来安全风险，用户需要自行承担风险。

这需要类似于操作系统中的安全杀毒软件来解决问题，但目前还是缺失的。

因此，尽量仅安装可以信任的第三方发行版、插件、应用程序。

:::

## 发行版

Yuan 是一个功能强大的操作系统，但它也太过于底层、原始和难用，只有极客型用户可以玩转，不适合直接给普通用户使用。

针对不同的用户场景，最好提供特定的发行版，预先配置好一些功能，以便用户可以直接使用。

以下，是我们提供的一些发行版，作为参考。您可以根据自己的需求，创建自己的发行版。

- [@yuants/dist-origin](https://github.com/No-Trade-No-Life/Yuan/tree/main/distributions/origin): 原生发行版 [点击在线体验](https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin)

发行版的本质是一个工作区，工作区的本质是一个文件目录及其中的内容。我们可以将工作区打包成一个发行版，然后用户可以下载并解压缩，即可使用。我们推荐使用 npm 包管理工具来管理发行版，即发行版会发布到 npm 仓库，用户可以通过 npm 安装发行版。

在 Web GUI 的地址参数中，我们可以通过 `from_npm` 参数来指定从 npm 安装发行版。例如，`https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin`。

URL 参数:

- `from_npm`: 是否从 npm 安装发行版。`1` 为是，留空为否。
- `scope`: npm 包的 scope，可选参数。
- `name`: npm 包的名称，必选参数。
- `version`: npm 包的版本，格式符合 [semver](https://semver.org/) 规范的版本号范围，可选参数。默认为最新版本。

```
// 安装 @yuants/dist-origin 发行版的最新版本
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin

// 安装 @yuants/dist-origin 发行版的特定版本 (0.0.2)
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=0.0.2

// 安装 @yuants/dist-origin 发行版的特定版本 (>=0.0.2)
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=>=0.0.2
```

:::warning[免责声明]

发行版的安全性和稳定性取决于发行版的作者，用户需要自行承担风险。

滥用发行版产生的风险，由发行版发布者、发行渠道以及用户自行承担，No Trade No Life 不承担任何责任。

:::

## 工作区的后端

不同的工作区后端，在访问速度、持久性、可共享性、兼容性上有所不同。

用户可以根据自己的需求选择合适的后端。

目前，Yuan 支持如下几种后端：

- FileSystem

  存储在本地计算机上的工作区，与本地文件系统中的一个文件夹绑定。

  用户需要选择一个文件夹作为工作区并授权 Yuan GUI 访问，之后的所有操作都会在这个工作区的内部完成。

  理论上提供与本地文件系统一致的体验！

  打开本地文件夹，截至 2024 年 9 月，作为浏览器的试验性功能，仍然仅支持桌面端的 Chrome 86 / Edge 86 / Opera 72 及其以上版本浏览器。暂时不支持移动端。

  可以通过 [这个页面](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) 持续跟踪兼容性。

- IndexedDB

  存储在浏览器 IndexedDB 中的工作区，会持久化到本地文件系统。

  但是，在用户磁盘空间不足时，被用户设备的原生操作系统主动清除。**此时，数据可能会丢失**。

  支持桌面端和移动端的主流浏览器。

- In-Memory

  存储在浏览器内存中的工作区，不会持久化到本地文件系统。

  **刷新后数据会丢失。** 适用于临时性地启动，不需要持久化数据。也适用于从网络启动第三方发行版。

  显然，支持所有设备。

:::note[计划建设的其他后端]

- Amazon S3

  S3 协议，全称为 Amazon S3（Simple Storage Service）协议，是 Amazon Web Services (AWS) 提供的一种对象存储服务协议。
  S3 协议定义了如何通过 HTTP/HTTPS 接口与 S3 服务进行交互，以存储、检索和管理数据对象。
  S3 协议已经成为**云存储领域的行业标准**，许多云服务提供商都提供了兼容 S3 协议的存储服务，例如 Aliyun OSS。

  存储在云端的工作区，与用户的云存储账户绑定。

  支持 HTTP API，因此可以兼容所有设备。但缺点是通过网络访问，速度可能会受到网络环境的影响，并可能产生额外的网络费用。

  用户需要授权 Yuan GUI 访问云存储，之后的所有操作都会在这个工作区的内部完成。

  适用于需要多设备同步的用户。

- 终端服务

  设备通过主机连接到同一主机内的另一个终端，而这个终端代理了一个文件系统，表现为一个文件系统。

  通常这个终端是一个容器或者 NodeJS 服务，连接到了一个文件系统。这个终端也受您控制，因而是隐私安全的。

  支持网络访问，因此可以兼容所有设备。但缺点是通过网络访问，速度可能会受到网络环境的影响，并可能产生额外的网络费用。同时，主机内的其他终端也可能会访问这个文件系统，需要注意权限控制。

  适用于需要多设备同步的用户。

:::
