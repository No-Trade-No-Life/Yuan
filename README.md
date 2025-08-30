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

## Motivation

Yuan is a "Personal Investment Operating System" that provides all the foundational software and infrastructure needed for diverse personal investment activities.

Our organization operates multiple quantitative trading projects that require a robust underlying platform - this is precisely why we created Yuan. We sustain Yuan's development through revenue generated from these projects, while selectively contributing portions of their code back to the Yuan ecosystem to enhance the platform's capabilities.

**In-house development is our security baseline**. While open-source pioneers have created excellent projects like VNPY, Zipline, BackTrader, and Qlib, why build another similar system? **Security supersedes efficiency**. Rather than critiquing others to assert superiority, we prioritize maximum self-development to maintain full control over every component. More third-party technologies mean more overlooked issues and technical debt. When systems adopted to reduce costs fail, they become existential threats.

**Yuan imposes no commercial restrictions**. You may legally use Yuan for commercial purposes, including developing proprietary applications or profit-generating derivatives.

**Yuan assumes no user liability**. Never deploy Yuan in production environments without thorough evaluation. We open-source under MIT license without warranties. Strongly recommend understanding and agreeing with our design philosophy before use. We prefer collaborative learning.

**Yuan seeks no venture capital**. The core project generates no direct revenue, offering no returns for investors. Development is sustained through our derivative implementations.

Industry Pain Points:

1. **Privacy Security**  
   Strategy code represents core intellectual property vulnerable to theft. Many products require uploading code to servers where providers could evaluate and steal strategies. Yuan's local workspace ensures privacy – even from us as project maintainers. Being open-source under community scrutiny guarantees no malicious code exists.

   **Our choice:** Strategy code never leaves user-trusted devices.

2. **Market Coverage**  
   Investors operate across markets. A strategy should apply universally without additional cost. Existing products often limit market access due to regional regulations or business constraints, forcing platform fragmentation. Our architecture decouples market-specific modules, enhancing software quality while enabling global compliance.

   **Our choice:** Standardized models for trading scenarios with global market support. Non-commercial use only.

3. **Cross-Platform Capability**  
   Markets don't accommodate user schedules. We enable operation on any device – desktop or mobile – without restrictions. Competitors often lock users to specific OS/hardware or charge multi-platform fees.

   **Our choice:** Browser-based Web UI for universal accessibility.

4. **Cost Efficiency**  
   Industry entry fees often exceed thousands with high maintenance costs – bundling development expenses, inefficiencies, or profiteering. As a product for individual investors, affordability is essential. Tools must be robust and economical across devices from PCs to server clusters.

   **Our choice:** Fully free. No commercial services. Zero cost transfer. Machine cost optimization guidance.

5. **Programming Barrier**  
   Coding skills remain essential for quant trading. Many possess viable strategies but lack programming ability to implement/test them. Outsourcing risks strategy theft and misimplementation, with slow iteration cycles. Proprietary DSLs (Domain-Specific Languages) further complicate learning without adequate documentation.

   **Our choice:** Modern TypeScript (no obscure DSLs). AI-assisted strategy coding. Rapid iteration capabilities.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built with

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started (Standalone Deployment) 🚀

Prerequisites:

- nodejs >= 22.14.0, [download Node.js](https://nodejs.org/en/download/) and install it, ensure the `npx` command is available in your local command line.
- PostgreSQL database, [download from official website](https://www.postgresql.org/download/) and install it, obtain a PostgreSQL database connection URI (`POSTGRES_URI`).

Run Yuan's Node unit from npx:

1. Create a local host and connect it to your database

   ```bash
   $ POSTGRES_URI="<your-postgres-uri>" npx @yuants/node-unit
   ```

2. Connect to the newly created local host using Web GUI

   Open your browser and visit http://y.ntnl.io, you will see Yuan's Web GUI.

   Find the network connection at the bottom right corner, configure the host with URL `ws://localhost:8888`, then click connect.

   Once connected successfully, you'll see the service list on the host and can use various services. Please follow the wizard in the GUI for further usage.

## Getting started (for developers) 🚀

Prerequisites: `nodejs >= 22.14.0`, [docker](https://www.docker.com/) for image build, and [rush](https://rushjs.io/) for mono repo management.

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

#### RPC Framework

Yuan implements communication between terminals in a distributed system through an RPC framework. It natively supports both browser and NodeJS environments. It uses a star topology where all terminals connect to a central Host node. Terminals can send messages to other terminals via the Host, which is responsible for message forwarding. Meanwhile, terminals utilize WebRTC to establish peer-to-peer connections for more efficient communication, reducing the Host's load. The Host acts as a signaling service to facilitate P2P connection establishment.

- [@yuants/protocol](libraries/protocol) Network protocols, service definitions, and infrastructure.
- [@yuants/app-host](apps/host) An ultra-lightweight in-memory message broker and service discovery. Terminals connected to the same host can send messages to each other. Supports connection authentication control via the environment variable `HOST_TOKEN`. Supports enabling a multi-tenancy environment through the environment variable `MULTI_TENANCY=ED25519`, which can automatically accept terminals with valid ED25519 signatures without requiring terminals to send private keys to the host.
- [@yuants/app-portal](apps/portal) Deploys a service that shares existing services (and channels) from one Host to others. Acts as an intermediary to forward messages between Hosts. A powerful tool for building data sharing scenarios.

#### Storage

Yuan uses PostgreSQL for general-purpose scenarios, Prometheus for telemetry metrics, and Redis for cached data.

##### Databases

Due to SQL complexity and significant variations between SQL databases, complex SQL statements are often incompatible. We default to only ensuring compatibility with PostgreSQL, sometimes requiring specific extensions (e.g., TimeScale DB).

- [@yuants/postgres-storage](apps/postgres-storage) A PostgreSQL storage service that connects PostgreSQL instances to Host services while hiding connection credentials.
- [@yuants/sql](libraries/sql) Client-side SQL library providing convenient read/write capabilities for PostgreSQL data in Hosts.

##### Telemetry

We plan to adopt OpenTelemetry as the telemetry standard while continuing to use Prometheus for metric storage.

- [@yuants/app-metrics-collector](apps/metrics-collector) Deploys a terminal as a metrics collection service, continuously gathering metrics from terminals. Works with Prometheus.
- [@yuants/prometheus-client](libraries/prometheus-client) Prometheus client for browser/Node, outperforming `promjs`.
- [@yuants/app-prometheus-client](apps/prometheus-client) Deploys a terminal as a Prometheus client service for querying Prometheus data, ideal for building monitoring dashboards.

#### Data Modeling

To unify global markets, we need a universal data model to represent market data. This data model facilitates data conversion and mapping across different markets.

The data modeling includes TypeScript types and SQL table definitions.

- [@yuants/data-product](libraries/data-product) Tradable products in markets.
- [@yuants/data-ohlc](libraries/data-ohlc) OHLC(V) data (Open, High, Low, Close with optional Volume) - a common market data format also known as candlestick charts.
- [@yuants/data-quote](libraries/data-quote) Level-1 quote data, specifically referring to a product's latest price and top-of-book market quotes.
- [@yuants/data-interest-rate](libraries/data-interest-rate) Interest rate data. Interest refers to the charges incurred when traders hold positions through settlement points. It's commonly used in forex trading and CFD (Contract for Difference) trading, and also applies to funding rates in perpetual contracts.
- [@yuants/data-account](libraries/data-account) Account and position data.
- [@yuants/data-order](libraries/data-order) Order data. An order represents a buy or sell instruction submitted by a trader to the market.

Legacy data models are maintained in [@yuants/data-model](libraries/data-model). We plan to split them into multiple specialized packages to reduce impact from non-core model changes.

Additionally, private data models that don't need to be shared between packages will be kept within their respective domain-specific packages.

We have identified two particularly useful properties of data: hierarchical structure and time-series nature.

**Hierarchical Structure**
For example, product hierarchies stem from different markets and various asset categories. Account information hierarchies originate from different brokers, parent-child account relationships, fund component structures, etc. Hierarchical properties enable us to store and manage vast amounts of data efficiently. The hierarchical nature also provides intuitive understanding - we only need to work within a specific subdirectory at any time.

**Time-Series Nature**
Data is typically generated chronologically and continuously aggregated by time periods. Taking OHLC data as an example, we can leverage time-series characteristics for data management across different time slices. For instance, we can periodically fetch data from providers and store it in databases. Time-series data offers highly efficient storage and query performance.

#### Data Collection

For relatively static data, we can retrieve it through data providers' APIs and store it in databases.

For time-series data, we need to periodically fetch data from providers and store it in databases.

We've defined constraints that time-series data should satisfy: [@yuants/data-series](libraries/data-series) - A generic time-series data model that defines fundamental properties and methods. Data service providers can use this to create their own time-series models and quickly implement data collection tasks.

We've introduced a time-series data collection scheduler: [@yuants/series-collector](apps/series-collector) - A universal time-series data collector that uses CronJob scheduled tasks to fetch data from various providers and store it in databases. Simply add a record to the `series_collecting_task` table in the database, and the collector will automatically fetch and store the data periodically.

#### Service Providers

Service providers act as connectors to external systems that interact with Yuan. These systems operate independently and generate new data autonomously.

Providers proxy requests/responses to external systems, which may include exchanges, data sources, or other external services. They store data locally and communicate with other terminals via the RPC framework.

Providers encompass exchanges, data sources, or any external data/services. Yuan's capabilities expand as more providers are added.

Access global markets through various providers. Each provider serves as a direct gateway to external services. Private data (account info, market data) isn't stored in Yuan cloud services - you can deploy providers on your own cloud or local machines. Data remains exclusively in your Host's storage.

- [@yuants/vendor-ctp](apps/vendor-ctp) Connects to the "Comprehensive Transaction Platform" (CTP) developed by Shanghai Futures Exchange (SHFE) for Chinese futures trading. Regulatory compliance may require broker permissions.
- [@yuants/vendor-ccxt](apps/vendor-ccxt) Connects to the "Cryptocurrency Exchange Trading Library" (CCXT), supporting numerous crypto exchanges via JavaScript/Python/PHP.
- [@yuants/vendor-binance](apps/vendor-binance) Connects to _Binance_, a leading cryptocurrency exchange.
- [@yuants/vendor-okx](apps/vendor-okx) Connects to _OKX_, a prominent cryptocurrency exchange.
- [@yuants/vendor-huobi](apps/vendor-huobi) Connects to _Huobi_, a well-known cryptocurrency exchange.
- [@yuants/vendor-gate](apps/vendor-gate) Connects to _Gate_, a notable cryptocurrency exchange.
- [@yuants/vendor-bitget](apps/vendor-bitget) Connects to _BitGet_, a significant cryptocurrency exchange.
- [@yuants/vendor-coinex](apps/vendor-coinex) Connects to _CoinEX_, a recognized cryptocurrency exchange.
- [@yuants/vendor-hyperliquid](apps/vendor-hyperliquid) Connects to _Hyperliquid_, a prominent on-chain cryptocurrency exchange.
- [@yuants/vendor-trading-view](apps/vendor-trading-view) Connects to _TradingView_, a renowned financial charting and trading platform. Enables usage of TradingView charts and indicators.
- [@yuants/vendor-tq](apps/vendor-tq) Connects to _TQ_, a prominent financial data provider. Allows access to TQ data services.
- [@yuants/app-email-notifier](apps/email-notifier) Email notification service supporting SMTP/IMAP protocols, storing messages in storage automatically.
- [@yuants/app-feishu-notifier](apps/feishu-notifier) Integrates with Feishu (Lark) bot system for notifications.
- [@yuants/app-openai](apps/openai) Deploys a terminal as an OpenAI service for text/image generation via OpenAI APIs.
- [@yuants/app-telegram-monitor](apps/telegram-monitor) Deploys a Telegram monitoring service to relay messages to other terminals.
- [@yuants/app-alert-receiver](apps/alert-receiver) Deploys an alert reception service that forwards alerts to notification terminals.

#### Agent

An Agent is a trading bot/strategy program that can automatically execute trading strategies and make decisions based on market data and account information. Agents can backtest on historical data or perform live trading with real-time data. You can customize an Agent's behavior and strategies.

- [@yuants/kernel](libraries/kernel) Provides a time-series simulation environment that can be combined with modules for different purposes.
- [@yuants/agent](libraries/agent) A Kernel-based trading bot containing the core trading strategy logic.
- [@yuants/app-agent](apps/agent) Deploys a standalone terminal as an Agent daemon service. You can run Agents in **live mode**, which automatically corrects historical data errors and restarts Agents after crashes.

#### Trade Execution

In the trade execution phase, we use an execution engine to convert an Agent's simulated positions into actual trading orders. The execution engine sends these orders to exchanges or other trading platforms.

- [@yuants/app-trade-copier](apps/trade-copier) Deploys a terminal as a trade copying service that monitors source accounts and ensures target accounts mirror them.

For multiple accounts, a transfer controller handles inter-account fund movements:

- [@yuants/app-transfer-controller](apps/transfer-controller) A service that monitors transfer requests and ensures completion of inter-account transfers.

You can even build a logistics network to automatically balance funds between accounts according to strategies:

- [@yuants/app-risk-manager](apps/risk-manager) Deploys a terminal as a risk management service that makes transfer decisions based on configured risk parameters.

#### Utilities

- [@yuants/utils](libraries/utils) General utilities not found in community packages.
- [@yuants/extension](libraries/extension) Defines extension interfaces for enhanced functionality.
- [@yuants/app-account-composer](apps/account-composer) Deploys an account aggregation service that combines multiple account balances into a unified view.
- [@yuants/app-k8s-manifest-operator](apps/k8s-manifest-operator) Deploys a Kubernetes manifest operator that ensures cluster state matches CRD definitions.

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
