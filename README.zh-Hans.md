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

## 快照

![image](https://github.com/No-Trade-No-Life/Yuan/assets/12707521/426f51d3-6ed3-4ad5-9583-ca8e63518965)

![image](https://github.com/No-Trade-No-Life/Yuan/assets/12707521/badf274a-7249-44c8-84fa-943ac6651d96)

![image](https://github.com/No-Trade-No-Life/Yuan/assets/12707521/6bac83f1-434d-400f-b6a1-a0874a812d5a)

## 动机

在我们量化交易事业的早期阶段，经过广泛搜索和研究各种现有的量化交易框架和产品后，我们发现没有一个能够完全满足我们独特交易策略的开发和研究需求。因此，我们不畏挑战，开始创造自己的产品——Yuan，以满足我们的特定需求。

我们的基本需求是：

1. **强隐私安全性**

   量化模型代码是用户的核心资产，存在被窃取的风险。市面上许多产品都需要将策略代码上传至服务器，而这些产品只要有用户的代码就可以充分评估并窃取代码，如果用户的策略可以被潜在的竞争对手掌握，那用户将处于不利地位。因此，市面上也有一些允许私有化部署的产品。而我们为用户设计了一个本地的工作区，可以保障用户的隐私免于被包括 Yuan 项目方在内的任何人窃取。并且我们完成了开源，受到开源社区的监督，不会在代码中做任何损害用户利益的事情。

2. **全市场兼容性**

   用户会在不同的市场中投资交易。我们希望同一份策略代码可以应用在不同的市场品种上，既可以历史回测，也可以实盘交易，这本不应该付出任何额外代价。同样也希望平台产品能够支持各种不同类型的市场。然而，市面上的产品，由于所处地区的法律法规和一些自身业务的限制，通常仅仅支持一部分的市场，迫使用户需要在不同的市场里，使用不同的平台。我们通过架构设计，与具体的市场模块解耦，不仅提升了软件的质量，还克服合规障碍，为产品的全球化铺路。

3. **跨平台兼容性**

   我们希望能在桌面端和移动端，任何平台的任何设备中，均能不受限制地运行我们的产品。毕竟，市场可不会顾及用户所处什么场合。用户可以在任何场景下，随时切入工作，与市场交互。

4. **低成本高扩展**

   行业初始许可费往往高达数千，更不用说高昂的额外和维护成本。我们认为这些成本部分是由于捆绑销售以抵消开发费用，部分是由于效率低下，部分是想牟取暴利。作为一个面向个人投资者而非企业的产品，我们必须考虑普通投资者的消费能力。对于投资者来说，工具最重要的方面是便宜、皮实。无论是个人电脑还是服务器集群，我们的产品都能有效运行。

Yuan 是一个投资操作系统，旨在赋予您掌握财务的能力。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

### 为什么使用 Yuan

**强大的 Web GUI**

通过 Yuan Web GUI，您可以获得一个全面的解决方案，用于创建、测试和管理您的交易系统，以及部署和监控您的应用程序。该 GUI 完全开源，可以在任何地方部署，无需互联网连接。您可以轻松地在多个环境之间切换，使用一个 GUI，使您的体验更加流畅。

我们设计 GUI 时考虑了现代浏览器，并集成了最新的网络技术，如 WebWorker、FileSystemHandle、WebRTC 等。它响应迅速且快速，我们正在不断努力使其对您来说更好。

虽然 GUI 目前是中文的，但我们计划使其国际化，以便您将来可以使用您的母语。我们欢迎对项目翻译的贡献，这样每个人都可以从这个惊人的工具中受益。您可以在 MIT 许可证下免费访问 GUI，无需安装任何东西 - 只需使用 [GUI](https://y.ntnl.io)。

**简单的语言和 AI 助手**

如果您对开发交易策略感兴趣，无需学习新语言或 DSL，现代 JavaScript/TypeScript 语言是一个绝佳的选择。您可以使用任何 IDE 编写代码，并使用任何版本控制系统进行管理。如果您在编码方面有困难，您可以向 AI 助手寻求帮助，通过沟通您的想法。

```ts
// 这是一个简单的趋势跟踪交易策略，使用 SMA 指标。
import { useSMA, useSimplePositionManager } from '@libs';
export default () => {
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const ma20 = useSMA(close, 20);
  const accountInfo = useAccountInfo();
  const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, 'XAUUSD');
  useEffect(() => {
    const idx = close.length - 2;
    if (close[idx] > ma20[idx]) {
      setTargetVolume(1);
    } else {
      setTargetVolume(0);
    }
  }, [close.length]);
};
```

更多示例可以在 [这里](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace) 找到。

**本地，云...或混合！**

Yuan 是一个混合云软件，允许您同时在家庭或公共云中部署您的交易系统。您可以从家庭 PC 开始，然后随着业务增长逐渐切换到公共云。选择家庭 PC 或公共云将取决于您的可用性、成本、隐私和安全要求。

**以扩展为核心的生态系统**

在 Yuan 中，扩展被视为一等公民。许多核心功能都是作为扩展构建和分发的。您可以使用扩展添加新功能，连接更多市场，并增强您的体验。您可以从社区下载扩展或创建自己的扩展与他人分享。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 构建于

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
[![nginx](https://img.shields.io/badge/nginx-009639?style=for-the-badge&logo=nginx&logoColor=FFFFFF)](https://www.nginx.com/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=FFFFFF)](https://github.com/pnpm/pnpm)
[![monaco editor](https://img.shields.io/badge/monaco-646CFF?style=for-the-badge&logo=visualstudiocode&logoColor=FFFFFF)](https://github.com/microsoft/monaco-editor)
[![vite](https://img.shields.io/badge/vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFFFFF)](https://github.com/vitejs/vite)
[![rollup](https://img.shields.io/badge/rollup-EC4A3F?style=for-the-badge&logo=rollupdotjs&logoColor=FFFFFF)](https://rollupjs.org/)
[![ajv](https://img.shields.io/badge/ajv-000000?style=for-the-badge&logo=ajv&logoColor=23C8D2)](https://github.com/ajv-validator/ajv)
[![webrtc](https://img.shields.io/badge/webrtc-333333?style=for-the-badge&logo=webrtc&logoColor=FFFFFF)](https://webrtc.org/)
[![letsencrypt](https://img.shields.io/badge/letsencrypt-003A70?style=for-the-badge&logo=letsencrypt&logoColor=FFFFFF)](https://letsencrypt.org/)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 开始使用（开发者）🚀

前提条件：`nodejs >= 22.14.0`，[docker](https://www.docker.com/) 用于镜像构建，[rush](https://rushjs.io/) 用于 mono repo 管理。

```bash
npm install -g @microsoft/rush
```

然后您可以安装依赖并构建项目

```bash
rush update && rush build
```

如果您没有安装 docker，可以通过设置环境变量 `CI_RUN` 为 `true` 来跳过 docker 构建。

```bash
CI_RUN=true rush build
```

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

### 代码导读

#### RPC 框架

Yuan 通过一套 RPC 框架来实现分布式系统中终端之间的通信。原生支持浏览器和 NodeJS 环境。它使用星形拓扑结构，所有终端都连接到一个中心节点主机（Host）。终端可以通过 Host 发送消息给其他终端。Host 负责转发消息。同时，终端会利用 WebRTC 来建立点对点连接，以实现更高效的通信，降低 Host 的负载，Host 会充当信令服务来帮助终端建立点对点连接。

- [@yuants/protocol](libraries/protocol) 网络协议、服务定义和基础设施。
- [@yuants/app-host](apps/host) Host 是一个非常轻量级的消息代理。终端可以连接到 Host 并相互发送消息。请注意，Host 中的所有终端应相互信任。实际上，Host 中的所有终端都属于同一所有者。无需验证每条消息。您可以部署多个 Host 以隔离风险。
- [@yuants/app-hosts](apps/hosts) 这是一个非常轻量级的主机集群，它可以在一个进程中处理多个主机的消息转发业务。无需提前注册主机的令牌表，它可以自动接受符合 ED25519 签名的终端，终端不需要向主机发送签名的私钥。非常适合于多租户环境和需要低成本创建多个主机的场景。
- [@yuants/host-manager](libraries/host-manager) 这是 Host 的底层抽象，它允许以编程方式管理若干互相隔离的 Host。它提供了一个简单的 API 来创建、删除和管理 Host。您可以使用它来创建多租户环境或隔离不同的业务。
- [@yuants/app-portal](apps/portal) 这将部署一个允许将主机中已有的服务（和频道）分享给其他主机的服务。它是一个中间人，它可以将消息从一个主机转发到另一个主机。它是一个非常强大的工具，可以帮助您构建数据分享场景。

#### 存储

Yuan 使用 PostgreSQL 作为通用场景数据库；使用 Prometheus 存储遥测指标；使用 Redis 存储缓存数据。

##### 数据库

由于 SQL 的复杂性，各种 SQL 数据库具有很大的差异性，较为复杂的 SQL 语句通常是不兼容的，我们默认只考虑在 PostgreSQL 上能够成功运行，甚至我们会要求 PostgreSQL 安装指定的插件 (例如 TimeScale DB)。

- [@yuants/postgres-storage](apps/postgres-storage) 这是一个 PostgreSQL 存储服务。它将 PostgreSQL 数据库实例接入主机服务，同时隐藏连接 PostgreSQL 所需的登录凭证。
- [@yuants/sql](libraries/sql) 客户端侧的 SQL 库，提供向主机中的 PostgreSQL 读写数据的快捷能力。

##### 遥测

未来我们会切换到 OpenTelemetry 作为遥测指标的标准，但我们仍然会使用 Prometheus 作为遥测指标的存储。

- [@yuants/app-metrics-collector](apps/metrics-collector) 这将部署一个终端作为指标收集服务。指标收集器持续从终端收集指标。它与 Prometheus 配合工作。
- [@yuants/prometheus-client](libraries/prometheus-client) 浏览器 / node 的 Prometheus 客户端。性能优于 `promjs`。
- [@yuants/app-prometheus-client](apps/prometheus-client) 这将部署一个终端作为 Prometheus 客户端。它提供了从 Prometheus 数据库查询数据的服务。适合于构建监控面板。

#### 数据建模

为了统一全球市场，我们需要一个通用的数据模型来表示市场数据。这个数据模型可以帮助我们在不同的市场之间进行数据转换和映射。

数据建模中包含了 TS 类型、SQL 表的定义。

- [@yuants/data-product](libraries/data-product) 市场中可交易的产品。
- [@yuants/data-ohlc](libraries/data-ohlc) OHLC(V) 数据。OHLC 是 Open、High、Low、Close 的缩写，是一种常用的市场数据格式，也称为 K 线。
- [@yuants/data-quote](libraries/data-quote) Level-1 报价数据，具体是指产品的最新价格和最优报价等信息。
- [@yuants/data-interest-rate](libraries/data-interest-rate) 利率数据。利率是指交易者持有头寸经过结算点时产生的利息。它通常用于外汇交易和差价合约 (CFD) 交易，同时也适用于永续合约的资金费率。
- [@yuants/data-account](libraries/data-account) 账户和持仓信息。

老旧的数据模型存放于 [@yuants/data-model](libraries/data-model)，我们计划将其拆分成很多不同的包，从而减少一些非核心模型变动冲击。

另外，不需要在包之间共享的私有数据建模，我们会放在对应领域的包中。

我们发现，数据有两种非常有用的性质：层级属性和时间序列性。

例如层级性，产品的层级性来源于不同的市场、不同门类的品种。账户信息的层级来源于不同的券商、母子账户关系、基金组件关系等。我们可以通过层级属性，存储并管理好非常大量的数据，并且层级性非常方便理解，每次只需要在一个子目录中完成工作。

例如时间序列性，数据通常是按照时间产生的，按照时间周期连续聚合的。例如 OHLC 数据，我们可以利用时间序列的特性，进行不同时间切片上的数据管理。例如，按照周期，从数据提供商处抓取数据，存储到数据库中。时间序列数据的存储和查询非常高效。

#### 数据采集

对于相对静态的数据，我们可以通过数据提供商的 API 获取数据，并存储到数据库中。

对于有时间序列属性的数据，我们需要定期从数据提供商处抓取数据，并存储到数据库中。

我们定义了时序序列应当满足的约束：[@yuants/data-series](libraries/data-series) 这是一个通用的时间序列数据模型。它定义了时间序列数据的基本属性和方法。数据服务提供商可以使用它来创建自己的时间序列数据模型，并快速完成数据采集任务。

我们引入一个时序数据的采集调度器：[@yuants/series-collector](apps/series-collector) 这是一个通用的时间序列数据收集器，它可以使用 CronJob 定期任务，从不同的数据提供商处抓取数据，并存储到数据库中。您只需要在数据库 `series_collecting_task` 表中添加一条记录，收集器就会定期抓取数据并存储到数据库中。

#### 服务提供商

服务提供商是指与 Yuan 交互的外部系统的连接器。这些系统独立于 Yuan，并且会独立产生新的数据。

服务提供商负责向外部系统代理请求和响应。它们可以是交易所、数据源或其他任何形式的外部服务。服务提供商会将数据存储在本地存储中，并通过 RPC 框架与其他终端进行通信。

服务提供商包括交易所、数据源，或者其他任何形式的数据和外部服务。因此，Yuan 的能力会随着服务提供商能力的增加而增强。

您可以通过各种服务提供商访问全球市场。每个服务提供商都是直接连接外部服务的网关。您的私人数据，包括账户信息和市场数据，不会存储在 Yuan 云服务中。您可以在自己的云或本地机器上部署供应商。这些数据仅会存储在您主机内的存储中。

- [@yuants/vendor-ctp](apps/vendor-ctp) 这连接到“综合交易平台”（CTP）。CTP 平台由上海期货交易所（SHFE）开发。CTP 提供中国的期货交易所。为了遵守法规，您可能需要从您的经纪公司请求许可。
- [@yuants/vendor-ccxt](apps/vendor-ccxt) 这连接到“加密货币交易所交易库”（CCXT）。CCXT 是一个支持许多加密货币交易所和交易市场的 JavaScript / Python / PHP 加密货币交易库。您可以使用它进行加密货币交易。
- [@yuants/vendor-binance](apps/vendor-binance) 这连接到 _Binance_，这是一个著名的加密货币交易所。
- [@yuants/vendor-okx](apps/vendor-okx) 这连接到 _OKX_，这是一个著名的加密货币交易所。
- [@yuants/vendor-huobi](apps/vendor-huobi) 这连接到 _Huobi_，这是一个著名的加密货币交易所。
- [@yuants/vendor-gate](apps/vendor-gate) 这连接到 _Gate_，这是一个著名的加密货币交易所。
- [@yuants/vendor-bitget](apps/vendor-bitget) 这连接到 _BitGet_，这是一个著名的加密货币交易所。
- [@yuants/vendor-coinex](apps/vendor-coinex) 这连接到 _CoinEX_，这是一个著名的加密货币交易所。
- [@yuants/vendor-hyperliquid](apps/vendor-hyperliquid) 这连接到 _Hyperliquid_，这是一个著名的链上加密货币交易所。
- [@yuants/app-email-notifier](apps/email-notifier) 支持 SMTP / IMAP 协议的电子邮件通知服务。它允许您通过电子邮件发送通知，并将邮件内容自动存入存储。
- [@yuants/vendor-trading-view](apps/vendor-trading-view) 这连接到 _TradingView_，这是一个著名的金融图表和交易平台。它允许您使用 TradingView 的图表和指标。
- [@yuants/vendor-tq](apps/vendor-tq) 这连接到 _TQ_，这是一个著名的金融数据提供商。它允许您使用 TQ 的数据。
- [@yuants/app-feishu-notifier](apps/feishu-notifier) 连接到飞书，接入飞书机器人体系。它允许您通过飞书发送通知等。
- [@yuants/app-openai](apps/openai) 这将部署一个终端作为 OpenAI 服务。它允许您使用 OpenAI 的 API 来生成文本、图像等。
- [@yuants/app-telegram-monitor](apps/telegram-monitor) 这将部署一个终端作为 Telegram 监控服务。它允许您监控 Telegram 消息，并将其发送到其他终端。
- [@yuants/app-alert-receiver](apps/alert-receiver) 这将部署一个终端作为警报接收服务。它从警报终端接收警报并发送给通知终端。

#### 智能体 (Agent)

智能体是一个交易机器人 / 策略程序。它可以自动执行交易策略，并根据市场数据和账户信息做出决策。智能体可以在历史数据上进行回测，也可以在实时数据上进行实盘交易。您可以自定义智能体的行为和策略。

- [@yuants/kernel](libraries/kernel) 提供一个时序模拟环境。可以搭配模块达成不同的目的。
- [@yuants/agent](libraries/agent) 基于 Kernel 的交易机器人。Agent 包含交易策略的核心。
- [@yuants/app-agent](apps/agent) 这将部署一个独立终端作为 Agent 的守护服务。您可以在 **真实模式** 下运行 Agent。它可以自动纠正历史数据错误。它还可以在 Agent 崩溃时自动重启。

#### 交易执行环节

在交易执行环节，我们用一个交易执行器将智能体的模拟仓位转换为实际的交易指令。交易执行器会将交易指令发送到交易所或其他交易平台。

- [@yuants/app-trade-copier](apps/trade-copier) 这将部署一个终端作为交易复制服务。它监视源账户并确保目标账户跟随源账户。

如果有多个账户，可以通过转账控制器来实现账户之间的转账。

- [@yuants/app-transfer-controller](apps/transfer-controller) 转账控制器是一个在账户之间转账的服务。它监视转账请求并确保转账完成。

甚至构建物流网络，在不同的账户之间按照策略自动平衡资金。

- [@yuants/app-risk-manager](apps/risk-manager) 这将部署一个终端作为风险管理器。它根据配置的风险信息做出转账决策。

#### 杂项

- [@yuants/utils](libraries/utils) 社区中未找到的一些通用工具。
- [@yuants/extension](libraries/extension) 这定义了扩展接口。您可以使用扩展来增强您的体验。
- [@yuants/app-account-composer](apps/account-composer) 这将部署一个终端作为账户组合服务。它将多个账户信息组合成一个账户信息。因此，您可以查看分散在多个账户中的资金。
- [@yuants/app-k8s-manifest-operator](apps/k8s-manifest-operator) 这将部署一个终端作为 Kubernetes 清单操作员。它监视 Kubernetes 集群的清单 CRD 并确保 Kubernetes 集群遵循清单 CRD。您可以将清单 CRD 添加到 k8s 集群，然后操作员将部署清单 CRD 中定义的资源。

#### Web UI

[@yuants/ui-web](ui/web)，您可以直接访问 https://y.ntnl.io 来访问 Yuan GUI。

图形用户界面（GUI）是目前应用最广泛的人机交互界面。它可以做到 命令行界面（CLI）、自然语言界面 (NUI, LUI) 能做到的一切事情。

- 单线发布：所有用户使用相同的、最新的 GUI 版本。
- 强隐私性：GUI 使用的工作区的内容是完全保密的。
- 可拓展性：您可以安装扩展来增强您的工作区。
- 多端适配：任何具有现代浏览器的设备都可以访问 GUI 及其功能，我们将持续提升多端适配性。
- 支持 PWA 安装为桌面应用程序。移动设备也可以使用 PWA 安装到主屏幕。

#### 发行版

Yuan 是一个功能强大的操作系统，但它也太过于底层、原始和难用，只有极客型用户可以玩转，不适合直接给普通用户使用。

针对不同的用户场景，最好提供特定的发行版，预先配置好一些功能，以便用户可以直接使用。

以下，是我们提供的一些发行版，作为参考。您可以根据自己的需求，创建自己的发行版。

- [@yuants/dist-origin](distributions/origin): 原生发行版 [点击在线体验](https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin)

##### 创建发行版

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

#### 文档

[@yuants/docs](ui/docs) 是 Yuan 的文档。

它由 [Docusaurus](https://docusaurus.io/) 构建。您可以在 [这里](https://www.ntnl.io/) 找到最新的文档。

#### 工具包

[@yuants/tool-kit](tools/toolkit) 是您所需要的一切。当您需要构建扩展时，这提供了 CLI。它帮助您构建 docker 镜像，创建捆绑包等等。以确保您的扩展已准备好使用。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 贡献

贡献使开源社区成为一个学习、启发和创造的绝佳场所。您所做的任何贡献都**非常感谢**。

如果您有改进此项目的建议，请 fork 仓库并创建一个拉取请求。您也可以简单地 [打开一个功能请求问题](https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=type%2Ffeature+%F0%9F%92%A1&projects=&template=feature_request.yaml&title=feat%3A+%3Ctitle%3E)。
不要忘记给项目加星！再次感谢！

1. Fork 项目
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m '添加一些 AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个拉取请求

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 联系

- 加入 Discord 服务器：[![Discord](https://img.shields.io/discord/1141802173676654675?style=for-the-badge&logo=discord)](https://discord.gg/BRH2447DUV)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 致谢 📖

1. [Yuan-Public-Data](https://github.com/No-Trade-No-Life/Yuan-Public-Data)
   我们的公共数据作为仓库维护在这里。免费使用。
   如果您有其他数据，欢迎贡献！

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
