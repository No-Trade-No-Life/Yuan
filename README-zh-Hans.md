[English](./README.md) | [简体中文](./README-zh-Hans.md)

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

1. **强大的隐私安全**

   量化模型代码是用户的核心资产，不应有被盗风险。市场上许多产品要求上传策略代码到服务器，在那里它们可以被完全评估和潜在盗取。如果用户的策略可以被潜在竞争对手掌握，用户将处于不利地位。因此，一些产品允许私有部署。我们为用户设计了一个本地工作区，确保隐私免受各种攻击，并允许我们证明我们的诚信。

2. **全面的市场兼容性**

   用户在不同市场进行投资和交易。我们希望相同的策略代码适用于各种市场类型，无论是历史回测还是实时交易，且无需额外成本。我们还希望平台能支持广泛的市场。然而，现有产品由于地区法规和商业限制，往往只支持部分市场，迫使用户为不同市场使用不同平台。通过架构设计，我们将核心解耦，将业务插件部署到市场，不仅降低了耦合度，提高了软件质量，还克服了合规障碍，为全球扩展奠定了基础。

3. **跨平台兼容性**

   我们希望我们的产品在任何设备上运行无限制，无论是桌面还是移动平台。毕竟，市场不会迎合用户所在的地方。用户应该能够在任何时间、任何地点与市场互动。

4. **低成本与高可扩展性**

   行业初始许可费往往高达数千，更不用说高昂的额外和维护成本。我们认为这些成本部分是由于捆绑销售以抵消开发费用，部分是由于运营效率低下，部分是由于牟利。作为一个面向个人投资者而非企业的产品，我们必须考虑普通投资者的财务能力。对于投资者来说，工具最重要的方面是负担得起和耐用。无论是个人电脑还是服务器集群，我们的产品都能有效运行。

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
[![mongodb](https://img.shields.io/badge/mongodb-47A248?style=for-the-badge&logo=mongodb&logoColor=FFFFFF)](https://github.com/mongodb/mongo)
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

前提条件：`nodejs >= 18.17.0`，[docker](https://www.docker.com/) 用于镜像构建，[rush](https://rushjs.io/) 用于 mono repo 管理。

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

#### 库

所有库默认应独立于平台。它们可以在浏览器、node.js 或其他平台上使用。并提供 ESM 和 CommonJS 模块。

- [@yuants/data-model](libraries/data-model) 数据模型及相关工具。
- [@yuants/protocol](libraries/protocol) 网络协议、服务定义和基础设施。
- [@yuants/utils](libraries/utils) 社区中未找到的一些通用工具。
- [@yuants/kernel](libraries/kernel) Time-Machine 的核心。Time-Machine 可以从历史到未来旅行。此包还包含一些有用的单元和场景。
- [@yuants/agent](libraries/agent) Agent 是一个交易机器人。Agent 包含交易策略的核心。
- [@yuants/extension](libraries/extension) 这定义了扩展接口。您可以使用扩展来增强您的体验。
- [@yuants/prometheus-client](libraries/prometheus-client) 浏览器 / node 的 Prometheus 客户端。性能优于 `promjs`。

#### 应用

所有应用应提供一个镜像并作为 npm 包发布。您可以通过 docker 和 Kubernetes 部署应用。您可以在 [应用列表](https://github.com/orgs/No-Trade-No-Life/packages?tab=packages&q=app-) 找到并获取镜像。所有应用都实现了扩展接口。因此，您可以将它们视为扩展。

- [@yuants/app-host](apps/host) Host 是一个非常轻量级的消息代理。终端可以连接到 Host 并相互发送消息。请注意，Host 中的所有终端应相互信任。实际上，Host 中的所有终端都属于同一所有者。无需验证每条消息。您可以部署多个 Host 以隔离风险。
- [@yuants/app-market-data-collector](apps/market-data-collector) 这将部署一个终端作为数据收集服务。终端持续从市场终端收集市场数据。
- [@yuants/app-data-collector](apps/data-collector) 这将部署一个终端作为数据收集服务。终端持续从数据系列提供者终端收集系列数据。这是市场数据收集器的一般版本。您可以使用它来收集任何数据系列。
- [@yuants/app-agent](apps/agent) 这将部署一个终端作为 Agent 的守护服务。您可以在 **真实模式** 下运行 Agent。它可以自动纠正历史数据错误。它还可以在 Agent 崩溃时自动重启。
- [@yuants/app-alert-receiver](apps/alert-receiver) 这将部署一个终端作为警报接收服务。它从警报终端接收警报并发送给通知终端。
- [@yuants/app-mongodb-storage](apps/mongodb-storage) 这将部署一个终端作为存储服务。它将数据存储在 MongoDB 中。
- [@yuants/app-email-notifier](apps/email-notifier) 这将部署一个终端作为通知服务。它将通知发送到您的电子邮件。
- [@yuants/app-feishu-notifier](apps/feishu-notifier) 这将部署一个终端作为通知服务。它通过 Feishu 机器人将通知发送到您的 Feishu。
- [@yuants/app-trade-copier](apps/trade-copier) 这将部署一个终端作为交易复制服务。它监视源账户并确保目标账户跟随源账户。
- [@yuants/app-metrics-collector](apps/metrics-collector) 这将部署一个终端作为指标收集服务。指标收集器持续从终端收集指标。它与 Prometheus 配合工作。
- [@yuants/app-account-composer](apps/account-composer) 这将部署一个终端作为账户组合服务。它将多个账户信息组合成一个账户信息。因此，您可以查看分散在多个账户中的资金。
- [@yuants/app-general-datasource](apps/general-data-source) 这将部署一个终端作为一般数据源服务。它将多个特定数据源组合成一个一般数据源。对于创建指数价格系列很有用。
- [@yuants/app-general-realtime-data-source](apps/general-realtime-data-source) 这将部署一个终端作为一般实时数据源服务。它是一般数据源的实时版本。对于创建指数价格 ticks 很有用。
- [@yuants/app-k8s-manifest-operator](apps/k8s-manifest-operator) 这将部署一个终端作为 Kubernetes 清单操作员。它监视 Kubernetes 集群的清单 CRD 并确保 Kubernetes 集群遵循清单 CRD。您可以将清单 CRD 添加到 k8s 集群，然后操作员将部署清单 CRD 中定义的资源。
- [@yuants/app-transfer-controller](apps/transfer-controller) 转账控制器是一个在账户之间转账的服务。它监视转账请求并确保转账完成。
- [@yuants/app-risk-manager](apps/risk-manager) 这将部署一个终端作为风险管理器。它根据配置的风险信息做出转账决策。

#### Web UI

[@yuants/ui-web](ui/web) 是 GUI。
您可以通过 GUI 做任何事情，因为我们更倾向于在 GUI 中实现功能而不是 CLI。
所有用户使用相同的 GUI 分发。它独立于主机和场景。
用户在本地有自己的工作区。工作区是秘密的。
您可以安装扩展来增强您的工作区。
任何具有现代浏览器的设备都可以访问 GUI 及其功能。但目前，桌面布局是最友好的。我们将在未来增强移动体验。

#### 文档

[@yuants/docs](ui/docs) 是 Yuan 的文档。

它由 [Docusaurus](https://docusaurus.io/) 构建。您可以在 [这里](https://www.ntnl.io/) 找到最新的文档。

#### 工具包

[@yuants/tool-kit](tools/toolkit) 是您所需要的一切。当您需要构建扩展时，这提供了 CLI。它帮助您构建 docker 镜像，创建捆绑包等等。以确保您的扩展已准备好使用。

#### 供应商

供应商包括市场、交易所和数据源。您可以通过各种供应商访问全球市场。由于某些法律原因，它们可能不对所有人开放。但如果您从提供者那里获得许可，您可以使用它们。

每个供应商都是直接连接外部服务的网关。您的私人数据，包括账户信息和市场数据，不会存储在 Yuan 云服务中。您可以在自己的云或本地机器上部署供应商。

- [@yuants/vendor-ctp](apps/vendor-ctp) 这连接到“综合交易平台”（CTP）。CTP 平台由上海期货交易所（SHFE）开发。CTP 提供中国的期货交易所。为了遵守法规，您可能需要从您的经纪公司请求许可。

- [@yuants/vendor-ccxt](apps/vendor-ccxt) 这连接到“加密货币交易所交易库”（CCXT）。CCXT 是一个支持许多加密货币交易所和交易市场的 JavaScript / Python / PHP 加密货币交易库。您可以使用它进行加密货币交易。

- [@yuants/vendor-binance](apps/vendor-binance) 这连接到 _Binance_，这是一个著名的加密货币交易所。

- [@yuants/vendor-okx](apps/vendor-okx) 这连接到 _OKX_，这是一个著名的加密货币交易所。

- [@yuants/vendor-huobi](apps/vendor-huobi) 这连接到 _Huobi_，这是一个著名的加密货币交易所。

- [@yuants/vendor-gate](apps/vendor-gate) 这连接到 _Gate_，这是一个著名的加密货币交易所。

- [@yuants/vendor-bitget](apps/vendor-bitget) 这连接到 _BitGet_，这是一个著名的加密货币交易所。

- [@yuants/vendor-coinex](apps/vendor-coinex) 这连接到 _CoinEX_，这是一个著名的加密货币交易所。

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

## 贡献者

衷心感谢以下贡献者：

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/zccz14"><img src="https://avatars.githubusercontent.com/u/12707521?v=4?s=100" width="100px;" alt="Zheng Chen"/><br /><sub><b>Zheng Chen</b></sub></a><br /><a href="#mentoring-zccz14" title="Mentoring">🧑‍🏫</a> <a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=zccz14" title="Code">💻</a> <a href="#design-zccz14" title="Design">🎨</a> <a href="https://github.com/No-Trade-No-Life/Yuan/pulls?q=is%3Apr+reviewed-by%3Azccz14" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://blog.thrimbda.com"><img src="https://avatars.githubusercontent.com/u/15231162?v=4?s=100" width="100px;" alt="Siyuan Wang"/><br /><sub><b>Siyuan Wang</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=Thrimbda" title="Code">💻</a> <a href="#infra-Thrimbda" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mage1028"><img src="https://avatars.githubusercontent.com/u/23522436?v=4?s=100" width="100px;" alt="Jinhaolin"/><br /><sub><b>Jinhaolin</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=mage1028" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://192217.space"><img src="https://avatars.githubusercontent.com/u/11043091?v=4?s=100" width="100px;" alt="Hobo Chen"/><br /><sub><b>Hobo Chen</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/issues?q=author%3AHoboChen" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://linxuyalun.github.io"><img src="https://avatars.githubusercontent.com/u/25969296?v=4?s=100" width="100px;" alt="Yalun Lin Hsu"/><br /><sub><b>Yalun Lin Hsu</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=linxuyalun" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/SakurazukaKen"><img src="https://avatars.githubusercontent.com/u/9213509?v=4?s=100" width="100px;" alt="SakurazukaKen"/><br /><sub><b>SakurazukaKen</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=SakurazukaKen" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/StayRealMayDay"><img src="https://avatars.githubusercontent.com/u/26059707?v=4?s=100" width="100px;" alt="Haoran Ren"/><br /><sub><b>Haoran Ren</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=StayRealMayDay" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/pruderior"><img src="https://avatars.githubusercontent.com/u/34360187?v=4?s=100" width="100px;" alt="pruderior"/><br /><sub><b>pruderior</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=pruderior" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Hikaru518"><img src="https://avatars.githubusercontent.com/u/7864982?v=4?s=100" width="100px;" alt="playground"/><br /><sub><b>playground</b></sub></a><br /><a href="https://github.com/No-Trade-No-Life/Yuan/commits?author=Hikaru518" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 联系

- 加入 Discord 服务器：[![Discord](https://img.shields.io/discord/1141802173676654675?style=for-the-badge&logo=discord)](https://discord.gg/BRH2447DUV)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 致谢 📖

1. [Yuan-Public-Workspace](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
   您可以从此仓库学习如何编写策略模型。您可以从 GUI 导入到您的工作区。该仓库嵌入了 AI 和向量数据库。
   非常感谢您贡献示例！
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
