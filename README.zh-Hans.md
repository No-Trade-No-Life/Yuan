[English](./README.md) | [简体中文](./README.zh-Hans.md)

<a name="readme-top"></a>

![语言 TS][language-shield]
[![贡献者](https://img.shields.io/github/all-contributors/No-Trade-No-Life/Yuan?color=ee8449&style=for-the-badge)](#contributors)
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![MIT 许可证][license-shield]][license-url]

[![Discord](https://img.shields.io/discord/1141802173676654675?style=for-the-badge&logo=discord)](https://discord.gg/BRH2447DUV)
[![问题][issues-shield]][issues-url]
[![开放的 Bug][bugs-open-shield]][bugs-open-url]
[![已关闭的 Bug][bugs-closed-shield]][bugs-closed-url]

<br />
<div align="center">
  <img src="https://y.ntnl.io/yuan.svg" alt="Logo" width="80" height="80" />
  <h3 align="center">Yuan</h3>
  <p align="center">
    <p>个人投资操作系统</p>
    <p>AI赋能，全球市场，无服务器，云原生，隐私保护。</p>
    <a align="center" href="https://y.ntnl.io">从任何设备访问 Yuan GUI »</a>
    <br />
    <br />
    <a href="https://www.ntnl.io">阅读文档 📖</a>
    ·
    <a href="https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=bug&projects=&template=bug_report.yaml&title=bug%3A+%3Ctitle%3E">报告 Bug 🐛</a>
    ·
    <a href="https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yaml&title=feat%3A+%3Ctitle%3E">请求功能 💡</a>
    ·
    <a href="https://discord.gg/BRH2447DUV">加入 Discord</a>
  </p>
</div>

## 动机

Yuan 是一个“个人投资操作系统”，包含各式各样的个人投资行为所需的一切基础软件和基础设施。

我们自身存在许多量化交易项目，这些项目需要一个基础平台，这就是 Yuan。我们使用这些项目的收入来维持 Yuan 的开发，并将这些项目的部分代码回馈到 Yuan 项目中，增强平台的能力。

**自研是安全底线**。实际上，有许多开源界的前辈已经做过许多优秀的项目了，例如 VNPY、Zipline，BackTrader、Qlib 等等。那么我们为什么还要再做一个类似的项目呢？**安全大于效率**。与其找一些角度把他们批判一番以证明我们的优越性，不如说我们需要尽可能多地自研，保证每一个环节都在掌控之中。引用的技术越多，忽略的问题越多，技术债越多。一旦出了问题，我们曾经为了节省开发成本而依赖的系统，就会反过来变成我们的催命符。

**Yuan 不限制商业使用**。你可以将 Yuan 用于合法的商业用途，基于 Yuan 进行二次开发、封装盈利性的应用等都是被允许的。

**Yuan 不承担用户责任**。不要随意将 Yuan 用于生产环境，我们基于 MIT 协议开源并免责。强烈建议在使用前充分理解并认同我们的设计。我们更希望与你交流学习。

**Yuan 不寻求风险投资**。Yuan 自身并没有盈利能力，风险投资者无法获得回报。

介绍一下量化交易行业的一些痛点：

1. **隐私安全**

   量化模型代码是用户的核心资产，存在被窃取的风险。市面上许多产品都需要将策略代码上传至服务器，而这些产品只要有用户的代码就可以充分评估并窃取代码，如果用户的策略可以被潜在的竞争对手掌握，那用户将处于不利地位。因此，市面上也有一些允许私有化部署的产品。而我们为用户设计了一个本地的工作区，可以保障用户的隐私免于被包括 Yuan 项目方在内的任何人窃取。并且我们完成了开源，受到开源社区的监督，不会在代码中做任何损害用户利益的事情。

   我们选择：模型代码永不离开用户信任的设备。

2. **市场覆盖**

   用户会在不同的市场中投资交易。我们希望同一份策略代码可以应用在不同的市场品种上，这本不需要付出任何额外代价。同样也希望平台产品能够支持各种不同类型的市场。然而，市面上的产品，由于所处地区的法律法规和一些自身业务的限制，通常仅仅支持一部分的市场，迫使用户需要在不同的市场里，使用不同的平台。我们通过架构设计，与具体的市场模块解耦剥离，不仅提升了软件的质量，还克服合规障碍，为产品的全球化铺路。

   我们选择：为交易场景设计标准模型，支持全球市场，追求高覆盖率。非商用产品，仅供学习交流。

3. **跨平台**

   我们希望能在桌面端和移动端，任何平台的任何设备中，均能不受限制地运行我们的产品。毕竟，市场可不会顾及用户所处什么场合。用户可以在任何场景下，随时切入工作，与市场交互。行业内有些产品，会要求用户在特定的操作系统上运行，或者需要特定的硬件支持。我们认为，用户不应该被限制在某个特定的平台上，更不应该为了多端使用而额外付费。

   我们选择：通过浏览器 WebUI 支持跨平台 UI。

4. **使用成本**

   行业初始许可费往往高达数千，更不用说高昂的额外和维护成本。我们认为这些成本部分是由于捆绑销售以抵消开发费用，部分是由于效率低下，部分是想牟取暴利。作为一个面向个人投资者而非企业的产品，我们必须考虑普通投资者的消费能力。对于投资者来说，工具最重要的方面是便宜、皮实。无论是个人电脑还是服务器集群，我们的产品都能有效运行。

   我们选择：完全免费，不提供任何商用服务，不转嫁任何成本给用户，协助用户控制机器成本。

5. **程序化门槛**

   不会编程就无法进行量化交易。对于大多数人来说，编程是一项高门槛的技能。许多人具有朴素原始的交易策略，但很难将其转化为程序化策略，更无法测试其性能。如果外包策略开发，用户会担心自己的策略被窃取，担心对方没有理解自己的意图，并且每次修改周期需要数小时到数天不等。如果不是自己能够编程，用户就无法开发量化交易策略，无法成为业内人士。另外，许多产品提供了特殊的编程方言（DSL），这使得用户需要学习新的编程语言或语法，却没有提供足够的社区支持，没有足够好的文档和学习资料。

   我们选择：拒绝小众方言，使用现代 TypeScript 语言，提供 AI 助手支持策略代写，实现快速策略迭代。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 技术栈

[![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=FFFFFF)](https://github.com/microsoft/TypeScript)
[![reactivex](https://img.shields.io/badge/reactivex-B7178C?style=for-the-badge&logo=reactivex&logoColor=FFFFFF)](https://github.com/ReactiveX/rxjs)
[![react](https://img.shields.io/badge/react-000000?style=for-the-badge&logo=react&logoColor=61DAFB)](https://github.com/facebook/react)
[![kubernetes](https://img.shields.io/badge/kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=FFFFFF)](https://github.com/kubernetes/kubernetes)
[![docker](https://img.shields.io/badge/docker-2496ED?style=for-the-badge&logo=docker&logoColor=FFFFFF)](https://www.docker.com/)
[![prometheus](https://img.shields.io/badge/prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=FFFFFF)](https://prometheus.io/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-4169E1?style=for-the-badge&logo=postgresql&logoColor=FFFFFF)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-FF4438?style=for-the-badge&logo=redis&logoColor=FFFFFF)](https://redis.io/)
[![zeromq](https://img.shields.io/badge/zeromq-DF0000?style=for-the-badge&logo=zeromq&logoColor=FFFFFF)](https://zeromq.org/)
[![openai](https://img.shields.io/badge/openai-412991?style=for-the-badge&logo=openai&logoColor=FFFFFF)](https://openai.com/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=FFFFFF)](https://github.com/pnpm/pnpm)
[![monaco editor](https://img.shields.io/badge/monaco-646CFF?style=for-the-badge&logo=visualstudiocode&logoColor=FFFFFF)](https://github.com/microsoft/monaco-editor)
[![vite](https://img.shields.io/badge/vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFFFFF)](https://github.com/vitejs/vite)
[![rollup](https://img.shields.io/badge/rollup-EC4A3F?style=for-the-badge&logo=rollupdotjs&logoColor=FFFFFF)](https://rollupjs.org/)
[![ajv](https://img.shields.io/badge/ajv-000000?style=for-the-badge&logo=ajv&logoColor=23C8D2)](https://github.com/ajv-validator/ajv)
[![webrtc](https://img.shields.io/badge/webrtc-333333?style=for-the-badge&logo=webrtc&logoColor=FFFFFF)](https://webrtc.org/)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 开始使用 (单机部署) 🚀

前提条件：

- nodejs >= 22.14.0，[下载 Node.js](https://nodejs.org/en/download/) 并安装，确保本地命令行中存在 `npx` 命令。

- TimeScaleDB (PostgreSQL + TimescaleDB 拓展)，参考 [官方网站](https://docs.tigerdata.com/self-hosted/latest/install/) 安装，获得一个 PostgreSQL 数据库连接 URI (`POSTGRES_URI`)。

我们强烈推荐从 Docker 直接启动 TimeScaleDB，这样可以保护操作系统不被污染。

```bash
$ docker pull timescale/timescaledb:latest-pg17
$ docker run -v </a/local/data/folder>:/pgdata -e PGDATA=/pgdata \
    -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb:latest-pg17
# 你可以获得 POSTGRES_URI=postgresql://postgres:password@localhost:5432/postgres
```

从 npx 运行 Yuan 的 Node 节点:

1. 创建本地主机，并连接到你的数据库

   ```bash
   $ POSTGRES_URI="<your-postgres-uri>" npx @yuants/node-unit
   ```

   更多的配置选项，请参考 [@yuants/node-unit](apps/node-unit) 。

2. 手动执行创建数据库表的脚本

   ```bash
   $ HOST_URL="ws://localhost:8888" npx @yuants/tool-sql-migration
   ```

3. 使用 Web GUI 连接刚刚创建的本地主机

   打开浏览器，访问 http://y.ntnl.io ，您将看到 Yuan 的 Web GUI。

   于右下角找到网络连接，配置主机，主机 URL 为 `ws://localhost:8888`，然后点击连接。

   待连接成功后，您可以看到主机中的服务列表，并使用各种服务，随后请遵循 GUI 中的向导进行使用。

## 开始使用（开发者）🚀

前提条件：`nodejs >= 22.14.0`，[docker](https://www.docker.com/) 用于镜像构建，[rush](https://rushjs.io/) 用于 mono repo 管理。

```bash
npm install -g @microsoft/rush
```

然后您可以安装依赖并构建项目

```bash
rush update && rush build
```

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

### 代码导读

为了保持 README 文件的简洁性，详细的代码导读和架构说明已移至专门的文档目录。请访问以下文档获取详细信息：

#### 📚 [查看完整中文文档](docs/zh-Hans/README.md)

**主要文档分类：**

- [**架构概述**](docs/zh-Hans/architecture-overview.md) - 系统整体架构和设计理念
- [**RPC 框架**](docs/zh-Hans/rpc-framework.md) - 分布式通信框架
- [**数据库**](docs/zh-Hans/database.md) - 数据存储和管理
- [**监控报警**](docs/zh-Hans/monitoring-alerting.md) - 系统监控和报警机制
- [**数据建模**](docs/zh-Hans/data-modeling.md) - 统一数据模型设计
- [**数据采集**](docs/zh-Hans/data-collection.md) - 时序数据采集系统
- [**服务提供商**](docs/zh-Hans/service-providers.md) - 外部系统连接器
- [**智能体**](docs/zh-Hans/agents.md) - 交易机器人和策略程序
- [**交易执行环节**](docs/zh-Hans/trading-execution.md) - 交易执行和风险管理
- [**Web UI**](docs/zh-Hans/web-ui.md) - 图形用户界面
- [**发行版**](docs/zh-Hans/distributions.md) - 预配置的系统版本
- [**开发工具**](docs/zh-Hans/toolkit.md) - 开发工具和 CLI

每个文档都包含了详细的组件说明、使用指南和最佳实践。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## Star 历史

[![Star 历史图](https://api.star-history.com/svg?repos=No-Trade-No-Life/Yuan&type=Date)](https://star-history.com/#No-Trade-No-Life/Yuan&Date)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- CONTRIBUTING -->

[license-shield]: https://img.shields.io/github/license/No-Trade-No-Life/Yuan.svg?style=for-the-badge
[license-url]: https://github.com/No-Trade-No-Life/Yuan/blob/main/LICENSE
[contributors-shield]: https://img.shields.io/github/contributors/No-Trade-No-Life/Yuan.svg?style=for-the-badge
[contributors-url]: https://github.com/No-Trade-No-Life/Yuan/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/No-Trade-No-Life/Yuan.svg?style=for-the-badge
[forks-url]: https://github.com/No-Trade-No-Life/Yuan/network/members
[stars-shield]: https://img.shields.io/github/stars/No-Trade-No-Life/Yuan.svg?style=for-the-badge
[stars-url]: https://github.com/No-Trade-No-Life/Yuan/stargazers
[issues-shield]: https://img.shields.io/github/issues/No-Trade-No-Life/Yuan.svg?style=for-the-badge&color=blue
[issues-url]: https://github.com/No-Trade-No-Life/Yuan/issues
[bugs-open-shield]: https://img.shields.io/github/issues/No-Trade-No-Life/Yuan/bug.svg?style=for-the-badge&color=yellow
[bugs-open-url]: https://github.com/No-Trade-No-Life/Yuan/issues?q=is%3Aissue+label%3Abug+is%3Aopen
[bugs-closed-shield]: https://img.shields.io/github/issues-closed/No-Trade-No-Life/Yuan/bug.svg?style=for-the-badge&color=success
[bugs-closed-url]: https://github.com/No-Trade-No-Life/Yuan/issues?q=is%3Aissue+label%3Abug+is%3Aclosed
[license-shield]: https://img.shields.io/github/license/No-Trade-No-Life/Yuan.svg?style=for-the-badge
[license-url]: https://github.com/No-Trade-No-Life/Yuan/blob/main/LICENSE.txt
[language-shield]: https://img.shields.io/badge/Language-TypeScript-blue?style=for-the-badge
