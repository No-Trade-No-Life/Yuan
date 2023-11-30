---
sidebar_position: 1
---

# 介绍

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
