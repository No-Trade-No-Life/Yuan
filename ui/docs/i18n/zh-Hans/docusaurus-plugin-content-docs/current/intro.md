---
sidebar_position: 1
---

# 介绍

## 动机

在我们做量化交易之初，在搜索并调研了各类现有的量化交易框架和产品后，发现没有一款产品可以完全满足我们自身的量化交易策略的开发和研究工作，于是我们不畏艰难险阻，从自身的需求出发，开始从头打造 Yuan 这款产品。

我们的基本诉求是：

1. **强隐私安全性**

   量化模型代码是用户的核心资产，不能有被窃取的风险。市面上许多产品都需要将策略代码上传至服务器，而这些产品只要有用户的代码就可以充分评估并窃取代码，如果用户的策略可以被潜在的竞争对手掌握，那用户将处于不利的位置。因此，市面上也有一些允许私有化部署的产品。而我们设计了一个用户本地的工作空间，可以充分地保障用户的隐私免于各方面的攻击，并且能自证我们的清白。

2. **全市场兼容性**

   用户会在不同的市场中投资交易。我们希望同一份策略代码可以应用在不同的市场品种上，既可以历史回测，也可以实盘交易，不应该付出任何额外代价。同样也希望平台产品能够支持各种不同类型的市场。然而，市面上的产品，由于所处地区的法律法规和一些自身业务的限制，通常仅仅支持一部分的市场，迫使用户需要在不同的市场里，使用不同的平台。我们通过架构设计，提前剥离了主体，将业务插件化投放市场，不仅降低了耦合度，提升了软件的质量，更重要的是跨过了合规障碍，为产品的全球化埋下伏笔。

3. **跨平台兼容性**

   我们希望能在桌面端和移动端，任何平台的任何设备中，均能不受限制地运行我们的产品。毕竟，市场可不会顾及用户所处什么场合。用户可以在任何场景下，随时切入工作，与市场交互。

4. **低成本高拓展**

   业界动辄成千上万的软件初期授权费用令人望而生畏，更不必说高昂的各种增值费用、维护费用。我们经过计算，认为这种费用一部分出于捆绑销售均摊开发成本，一部分则是运行效率低下，还有一部分则是炒作割韭菜之流。我们作为面向个人而不是企业的产品，必然要为普通个人投资者的消费能力考虑。对于投资者来说，工具资本最重要的还是便宜、皮实。穷则战术穿插，富则火力覆盖。无论是一台个人电脑，还是机房服务器集群，我们都可以跑起来。

Yuan 是一个投资操作系统，帮助您掌控资金。

### 为什么使用 Yuan

**强大的 GUI**

借助 Yuan Web GUI，您可以访问全面的解决方案来创建、测试和管理您的交易系统，以及部署和监控您的应用程序。GUI 完全开源，可以部署在任何地方，无需互联网连接。您只需使用一个 GUI 即可轻松在多个环境之间切换，让您的体验更加流畅。

我们在设计 GUI 时考虑了现代浏览器，并与最新的 Web 技术集成，例如 WebWorker、FileSystemHandle、WebRTC 等。它反应灵敏且速度快，我们不断努力使其更好地为您服务。

虽然 GUI 目前是用中文编写的，但我们计划将其国际化，以便您将来可以用您的母语使用它。我们欢迎对该项目的翻译做出贡献，这样每个人都可以从这个神奇的工具中受益。您可以在 MIT 许可证下免费访问 GUI，无需安装任何东西 - 只需使用 [GUI](https://y.ntnl.io) 即可。

**简单的语言和 AI 助手**

如果您有兴趣开发交易策略而不需要学习新语言或 DSL，那么现代 JavaScript/TypeScript 语言是一个很好的选择。您可以使用任何 IDE 来编写代码，并使用任何版本控制系统来管理它。如果您在编码方面遇到困难，您可以通过向人工智能助手传达您的想法来寻求帮助。

```ts
// It's a simple trend-tracking trading strategy that uses the SMA indicator.
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

更多示例可以在[这里](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)找到。

**本地、云...或混合！**

Yuan 是一款混合云软件，允许您同时在家庭或公共云中部署交易系统。您可以开始使用家用电脑，然后随着业务的发展逐渐切换到公共云。在家用电脑还是公共云之间进行选择将取决于您的可用性、成本、隐私和安全要求。

**扩展优先的生态系统**

在 Yuan 中，拓展被视为一等公民。许多核心功能都是作为扩展构建和分发的。您可以使用扩展程序来添加新功能、连接更多市场并增强您的体验。您可以从社区下载扩展程序或创建自己的扩展程序以与其他人共享。
