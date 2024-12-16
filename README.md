[English](./README.md) | [简体中文](./README.zh-Hans.md)

<a name="readme-top"></a>

![Language TS][language-shield]
[![Contributors](https://img.shields.io/github/all-contributors/No-Trade-No-Life/Yuan?color=ee8449&style=for-the-badge)](#contributors)
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![MIT License][license-shield]][license-url]

[![Discord](https://img.shields.io/discord/1141802173676654675?style=for-the-badge&logo=discord)](https://discord.gg/BRH2447DUV)
[![Issues][issues-shield]][issues-url]
[![Bugs Open][bugs-open-shield]][bugs-open-url]
[![Bugs Closed][bugs-closed-shield]][bugs-closed-url]

<br />
<div align="center">
  <img src="https://y.ntnl.io/yuan.svg" alt="Logo" width="80" height="80" />
  <h3 align="center">Yuan</h3>
  <p align="center">
    <p>Personal Investment Operating System</p>
    <p>AI empowered, global market, serverless, cloud-native, and privacy.</p>
    <a align="center" href="https://y.ntnl.io">Access the Yuan GUI from any device »</a>
    <br />
    <br />
    <a href="https://www.ntnl.io">Read the Docs 📖</a>
    ·
    <a href="https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=bug&projects=&template=bug_report.yaml&title=bug%3A+%3Ctitle%3E">Report Bug 🐛</a>
    ·
    <a href="https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yaml&title=feat%3A+%3Ctitle%3E">Request Feature 💡</a>
    ·
    <a href="https://discord.gg/BRH2447DUV">Join Discord</a>
  </p>
</div>

## Snapshots

![image](https://github.com/No-Trade-No-Life/Yuan/assets/12707521/426f51d3-6ed3-4ad5-9583-ca8e63518965)

![image](https://github.com/No-Trade-No-Life/Yuan/assets/12707521/badf274a-7249-44c8-84fa-943ac6651d96)

![image](https://github.com/No-Trade-No-Life/Yuan/assets/12707521/6bac83f1-434d-400f-b6a1-a0874a812d5a)

## Motivation

In the early stages of our quantitative trading endeavors, after extensively searching and researching various existing quantitative trading frameworks and products, we found that none could fully meet the development and research needs of our unique trading strategies. Thus, undeterred by the challenges, we embarked on creating our own product, Yuan, driven by our specific requirements.

Our basic requirements are:

1. **Strong Privacy Security**

   Quantitative model code is the core asset of users and is at risk of being stolen. Many products on the market require uploading strategy code to servers, and these products can fully evaluate and steal the code as long as they have the user's code. If the user's strategy can be grasped by potential competitors, the user will be at a disadvantage. Therefore, there are also some products on the market that allow private deployment. We have designed a local workspace for users to ensure that their privacy is protected from being stolen by anyone, including the Yuan project team. Additionally, we have completed open-source, subject to the supervision of the open-source community, and will not do anything in the code that harms the interests of users.

2. **Full Market Compatibility**

   Users invest and trade in different markets. We hope that the same strategy code can be applied to different market varieties, both for historical backtesting and real-time trading, without any additional cost. We also hope that the platform product can support various types of markets. However, due to regional laws and regulations and some business restrictions, products on the market usually only support a part of the markets, forcing users to use different platforms in different markets. Through architectural design, we decouple specific market modules, not only improving software quality but also overcoming compliance obstacles, paving the way for the globalization of the product.

3. **Cross-Platform Compatibility**

   We hope that our product can run without restrictions on any device on any platform, whether on desktop or mobile. After all, the market does not care about the user's situation. Users can switch to work and interact with the market at any time in any scenario.

4. **Low Cost and High Scalability**

   Industry initial licensing fees often reach thousands, not to mention the high additional and maintenance costs. We believe that these costs are partly due to bundling sales to offset development costs, partly due to inefficiency, and partly due to the desire to profit. As a product aimed at individual investors rather than enterprises, we must consider the consumption ability of ordinary investors. For investors, the most important aspect of tools is cheap and durable. Whether on personal computers or server clusters, our product can run effectively.
   Yuan is an investment operating system designed to empower you to master your finances.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Why use Yuan

**Powerful Web GUI**

With Yuan Web GUI, you have access to a comprehensive solution for creating, testing, and managing your trading system, as well as deploying and monitoring your applications. The GUI is completely open-source and can be deployed anywhere, without an internet connection. You can easily switch between multiple environments using just one GUI, making your experience more streamlined.

We have designed the GUI with modern browsers in mind, and it integrates with the latest web technologies, such as WebWorker, FileSystemHandle, WebRTC, and more. It is highly responsive and fast, and we are constantly working to make it even better for you.

Although the GUI is currently written in Chinese, we have plans to make it internationalized, so you can use it in your native language in the future. We welcome contributions to the project's translation, so everyone can benefit from this amazing tool. You can access the GUI for free under the MIT license, without the need to install anything - simply use the [GUI](https://y.ntnl.io).

**Simple language and AI assistant**

If you're interested in developing a trading strategy without the need to learn a new language or DSL, the modern JavaScript/TypeScript language is an excellent option. You can use any IDE to write your code and any version control system to manage it. If you have difficulty with coding, you can seek assistance from an AI assistant by communicating your idea to it.

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

More examples can be found [here](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace).

**Local, cloud...or hybrid!**

Yuan is a hybrid-cloud software that allows you to deploy your trading system in your home or public cloud simultaneously. You can start using your home PC and then gradually switch to the public cloud as your business grows. Choosing between your home PC or the public cloud will depend on your availability, costs, privacy, and security requirements.

**Extension-first Ecosystem**

In Yuan, extensions are treated as first-class citizens. Many core features are built and distributed as extensions. You can use extensions to add new features, connect with more markets, and enhance your experience. You can download extensions from the community or create your own extensions to share with others.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built with

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started (for developers) 🚀

Prerequisites: `nodejs >= 18.17.0`, [docker](https://www.docker.com/) for image build, and [rush](https://rushjs.io/) for mono repo management.

```bash
npm install -g @microsoft/rush
```

Then you can install dependencies and build projects

```bash
rush update && rush build
```

If you have no docker installed, you can skip the docker build by setting the environment variable `CI_RUN` to `true`.

```bash
CI_RUN=true rush build
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Packages

#### Libraries

All the libraries should be independent of the platform by default. They can be used in the browser, node.js, or other platforms. And provide both ESM and CommonJS modules.

- [@yuants/data-model](libraries/data-model) Data Model and related utils.
- [@yuants/protocol](libraries/protocol) Network protocol, service definition and infrastructure.
- [@yuants/utils](libraries/utils) Some general utils that are not found in the community.
- [@yuants/kernel](libraries/kernel) The kernel of Time-Machine. Time-Machine can travel from history to the future. This package also contains some useful units and scenes.
- [@yuants/agent](libraries/agent) Agent is a trading bot. The agent contains the core of the trading strategy.
- [@yuants/extension](libraries/extension) This defined the extension interface. You can use extensions to enhance your experience.
- [@yuants/prometheus-client](libraries/prometheus-client) Prometheus client for the browser / node. Better performance than `promjs`.

#### Apps

All the apps should provide an image and publish it as a npm package. You can deploy the app by docker and Kubernetes. You can find the [App List](https://github.com/orgs/No-Trade-No-Life/packages?tab=packages&q=app-) and get the image. All the apps implemented the extension interface. So you can treat them as extensions.

- [@yuants/app-host](apps/host) Host is a very lightweight message broker. Terminals can connect to the host and send messages to each other. Notice that all terminals in a host should trust each other. In practice, all the terminals in a host belong to the same owner. There's no need to verify every message. You can deploy multiple hosts to isolate the risk.
- [@yuants/app-market-data-collector](apps/market-data-collector) This will deploy a terminal as a data-collecting service. The terminal collects market data from the market terminals continuously.
- [@yuants/app-data-collector](apps/data-collector) This will deploy a terminal as a data-collecting service. The terminal collects series data from the data series provider terminals continuously. It's a general version of the market data collector. You can use it to collect any data series.
- [@yuants/app-agent](apps/agent) This will deploy a terminal as the daemon service of the agent. You can run the agent in **real mode**. It can automatically correct the history data error. It can also automatically restart the agent when it crashes.
- [@yuants/app-alert-receiver](apps/alert-receiver) This will deploy a terminal as an alert-receiving service. It receives alerts from the alert terminals and sends them to the notifier terminals.
- [@yuants/app-mongodb-storage](apps/mongodb-storage) This will deploy a terminal as a storage service. It stores data in MongoDB.
- [@yuants/app-email-notifier](apps/email-notifier) This will deploy a terminal as a notifier service. It sends notifications to your email.
- [@yuants/app-feishu-notifier](apps/feishu-notifier) This will deploy a terminal as a notifier service. It sends notifications to your Feishu by a Feishu bot.
- [@yuants/app-trade-copier](apps/trade-copier) This will deploy a terminal as a trade copier service. It watches the source accounts and ensures the target accounts follow the source accounts.
- [@yuants/app-metrics-collector](apps/metrics-collector) This will deploy a terminal as a metrics-collecting service. The metrics collector collects metrics from terminals continuously. It works with Prometheus.
- [@yuants/app-account-composer](apps/account-composer) This will deploy a terminal as an account-composing service. It composes multiple account info into one account info. So you can view your money dispersed across many accounts.
- [@yuants/app-general-datasource](apps/general-data-source) This will deploy a terminal as a general data source service. It composes multiple specific data sources into one general data source. Useful for creating an index price series.
- [@yuants/app-general-realtime-data-source](apps/general-realtime-data-source) This will deploy a terminal as a general real-time data source service. It's the real-time version of the general data source. Useful for creating an index price ticks.
- [@yuants/app-k8s-manifest-operator](apps/k8s-manifest-operator) This will deploy a terminal as a Kubernetes manifest operator. It watches the manifest CRD of the Kubernetes cluster and ensures the Kubernetes cluster follows the manifest CRD. You can add manifest CRD to the k8s cluster and then the operator will deploy the resources defined in the manifest CRD.
- [@yuants/app-transfer-controller](apps/transfer-controller) A transfer controller is a service that transfers money between accounts. It watches the transfer request and ensures the transfer is completed.
- [@yuants/app-risk-manager](apps/risk-manager) This will deploy a terminal as a risk manager. It makes transfer decisions based on the configured risk info.
- [@yuants/app-hosts](apps/hosts) This is a very lightweight host cluster that can handle message forwarding business for multiple hosts within a single process. There is no need to pre-register the host's token table; it can automatically accept terminals that comply with ED25519 signatures, and terminals do not need to send the signed private key to the host. It is highly suitable for multi-tenant environments and scenarios that require low-cost creation of multiple hosts.
- [@yuants/app-portal](apps/portal) This will deploy a service that allows sharing existing services (and channels) from a host with other hosts. It acts as an intermediary, capable of forwarding messages from one host to another. It is a very powerful tool that can help you build data sharing scenarios.
- [@yuants/app-namespaced-mongodb-storage](apps/namespaced-mongodb-storage) This will deploy a terminal as a storage service. It stores data in MongoDB and supports namespaces. This means you can store data for multiple tenants within the same MongoDB instance.
- [@yuants/app-prometheus-client](apps/prometheus-client) This will deploy a terminal as a Prometheus client. It provides a service for querying data from the Prometheus database, making it suitable for building monitoring dashboards.

#### Web UI

[@yuants/ui-web](ui/web), you can directly access https://y.ntnl.io to access the Yuan GUI.

The graphical user interface (GUI) is the most widely used human-computer interaction interface today. It can do everything that command-line interfaces (CLI), natural language interfaces (NUI, LUI), and other interfaces can do.

- **Single-line Deployment**: All users use the same, latest version of the GUI.
- **Strong Privacy**: The content of the workspace used by the GUI is completely confidential.
- **Extensibility**: You can install extensions to enhance your workspace.
- **Multi-device Adaptation**: Any device with a modern browser can access the GUI and its features. We will continuously improve multi-device adaptability.
- **PWA Support**: The GUI can be installed as a desktop application via PWA. Mobile devices can also use PWA to install to the home screen.

#### Distributions

Yuan is a powerful operating system, but it is also too low-level, primitive, and difficult to use. Only tech-savvy users can handle it, and it is not suitable for direct use by ordinary users.

For different user scenarios, it is best to provide specific distributions that are pre-configured with some features so that users can use them directly.

Below are some distributions we provide as references. You can create your own distributions based on your needs.

- [@yuants/dist-origin](distributions/origin): Native distribution [Click to experience online](https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin)

##### Creating a Distribution

The essence of a distribution is a workspace, and the essence of a workspace is a file directory and its contents. We can package the workspace into a distribution, and then users can download and unzip it to use. We recommend using the npm package management tool to manage distributions, i.e., distributions will be published to the npm repository, and users can install distributions via npm.

In the Web GUI's address parameters, we can specify installing the distribution from npm using the `from_npm` parameter. For example, `https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin`.

**URL Parameters**:

- `from_npm`: Whether to install the distribution from npm. `1` for yes, leave empty for no.
- `scope`: The scope of the npm package, optional parameter.
- `name`: The name of the npm package, required parameter.
- `version`: The version of the npm package, in the format of a [semver](https://semver.org/) compliant version range, optional parameter. Defaults to the latest version.

```
// Install the latest version of the @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin

// Install a specific version (0.0.2) of the @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=0.0.2

// Install a specific version (>=0.0.2) of the @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=>=0.0.2
```

#### Documents

[@yuants/docs](ui/docs) is the document of Yuan.

It's built by [Docusaurus](https://docusaurus.io/). You can find the latest documents [here](https://www.ntnl.io/).

#### Toolkit

[@yuants/tool-kit](tools/toolkit) is all you need. This provides a CLI when you need to build an extension. It helps you to build a docker image, create a bundle and more. To ensure your extension is ready to use.

#### Vendors

Vendors include markets, exchanges, and data sources. You can access the global market through various vendors. For some legal reason, they are probably not open to everyone. But you can use them if you gain permission from the provider.

Every vendor is a gateway to connect the external service directly. Your private data including account info and market data will not be stored in Yuan Cloud Service. You can deploy the vendor in your own cloud or local machine.

- [@yuants/vendor-ctp](apps/vendor-ctp) This connects to the "Comprehensive Transaction Platform" (CTP). The CTP platform was developed by the Shanghai Futures Exchange (SHFE). CTP provides China's future exchanges. To comply with regulations, you might have to request permission from your broker company.

- [@yuants/vendor-ccxt](apps/vendor-ccxt) This connects to the "CryptoCurrency eXchange Trading Library" (CCXT). CCXT is a JavaScript / Python / PHP cryptocurrency trading library that supports many cryptocurrency exchanges and trading markets. You can use it to trade cryptocurrencies.

- [@yuants/vendor-binance](apps/vendor-binance) This connects to _Binance_, which is a famous crypto exchange.

- [@yuants/vendor-okx](apps/vendor-okx) This connects to _OKX_, which is a famous crypto exchange.

- [@yuants/vendor-huobi](apps/vendor-huobi) This connects to _Huobi_, which is a famous crypto exchange.

- [@yuants/vendor-gate](apps/vendor-gate) This connects to _Gate_, which is a famous crypto exchange.

- [@yuants/vendor-bitget](apps/vendor-bitget) This connects to _BitGet_, which is a famous crypto exchange.

- [@yuants/vendor-coinex](apps/vendor-coinex) This connects to _CoinEX_, which is a famous crypto exchange.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions make the open-source community a fantastic place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply [open a feature request issue](https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=type%2Ffeature+%F0%9F%92%A1&projects=&template=feature_request.yaml&title=feat%3A+%3Ctitle%3E).
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

- Join Discord server: [![Discord](https://img.shields.io/discord/1141802173676654675?style=for-the-badge&logo=discord)](https://discord.gg/BRH2447DUV)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments 📖

1. [Yuan-Public-Data](https://github.com/No-Trade-No-Life/Yuan-Public-Data)
   Our public data is maintained here as a repository. Free to use.
   Welcome to contribute if you have other data!

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=No-Trade-No-Life/Yuan&type=Date)](https://star-history.com/#No-Trade-No-Life/Yuan&Date)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
