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
- TimeScaleDB (PostgreSQL + TimescaleDB extension), refer to [official website](https://docs.tigerdata.com/self-hosted/latest/install/) for installation, obtain a PostgreSQL database connection URI (`POSTGRES_URI`).

We strongly recommend starting TimeScaleDB directly from Docker to protect your operating system from contamination.

```bash
$ docker pull timescale/timescaledb:latest-pg17
$ docker run -v </a/local/data/folder>:/pgdata -e PGDATA=/pgdata \
    -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb:latest-pg17
# You can get POSTGRES_URI=postgresql://postgres:password@localhost:5432/postgres
```

Run Yuan's Node unit from npx:

1. Create a local host and connect it to your database

   ```bash
   $ POSTGRES_URI="<your-postgres-uri>" npx @yuants/node-unit
   ```

   For more configuration options, please refer to [@yuants/node-unit](apps/node-unit).

2. Manually execute the script to create database tables

   ```bash
   $ HOST_URL="ws://localhost:8888" npx @yuants/tool-sql-migration
   ```

3. Connect to the newly created local host using Web GUI

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Code Introduction

To keep the README file concise, detailed code introduction and architecture explanations have been moved to specialized documentation. Please visit the following documentation for detailed information:

#### 📚 [View Complete English Documentation](docs/en/README.md)

**Main Documentation Categories:**

- [**Architecture Overview**](docs/en/architecture-overview.md) - System overall architecture and design philosophy
- [**RPC Framework**](docs/en/rpc-framework.md) - Distributed communication framework
- [**Database**](docs/en/database.md) - Data storage and management
- [**Monitoring and Alerting**](docs/en/monitoring-alerting.md) - System monitoring and alerting mechanisms
- [**Data Modeling**](docs/en/data-modeling.md) - Unified data model design
- [**Data Collection**](docs/en/data-collection.md) - Time series data collection system
- [**Service Providers**](docs/en/service-providers.md) - External system connectors
- [**Agents**](docs/en/agents.md) - Trading bots and strategy programs
- [**Trading Execution**](docs/en/trading-execution.md) - Trading execution and risk management
- [**Web UI**](docs/en/web-ui.md) - Graphical user interface
- [**Distributions**](docs/en/distributions.md) - Pre-configured system versions
- [**Development Tools**](docs/en/toolkit.md) - Development tools and CLI

Each document includes detailed component descriptions, usage guides, and best practices.

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
