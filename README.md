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
    <p>The money OS for everyone defends their own wealth.</p>
    <p>AI empowered, global market, serverless, cloud-native, and privacy.</p>
    <a align="center" href="https://y.ntnl.io">Access the Yuan GUI from any device »</a>
    <br />
    <br />
    <a href="https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=type%2Fbug+%F0%9F%90%9B&projects=&template=bug_report.yaml&title=bug%3A+%3Ctitle%3E">Report Bug 🐛</a>
    ·
    <a href="https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=type%2Ffeature+%F0%9F%92%A1&projects=&template=feature_request.yaml&title=feat%3A+%3Ctitle%3E">Request Feature 💡</a>
    ·
    <a href="https://discord.gg/BRH2447DUV">Join Discord</a>
  </p>
</div>

## About The Project

<img width="2560" alt="image" src="https://github.com/No-Trade-No-Life/Yuan/assets/12707521/b31243a9-18d5-45ed-9c73-6806a8f60f00">


I'm a software engineer. And I want to make money through quantitative and automatic trading.

There are many great tools and platforms available. However, I didn't find one that suited my need, so I created Yuan.

Here's why:

- My trading strategy is secret. I am afraid someone illegally obtains the results. I can test and run it on trusted devices.
- The historical data is highly reused and never updated anymore. I can download the data once and use it forever. So the data should be free.
- Most devices have installed browsers. I can work everywhere through a browser. Fast starting without installing Python or other prerequisites.
- The market is similar around the world. I can trade in any global market without changing any strategy code. Write once, and run everywhere.
- Real-world trading is important. The trading system should be highly available. I can easily create and maintain ones.

For more general usages:
- Maybe you feel troubled about coding. You can ask an AI assistant for help. Just tell AI your idea and run. AI can complete the code.
- Maybe you need to manage your money dispersed across many accounts.

In summary, I hope Yuan can be an operating system, which helps you control your money.

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

## Getting started 🚀

Prerequisites: `nodejs >= 18.17.0` and [rush](https://rushjs.io/) for monorepo management.

```bash
npm install -g @microsoft/rush
```

Then you can install dependencies and build projects

```bash
rush update && rush build
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Packages

- [@yuants/data-model](libraries/data-model) Data Model and related utils.
- [@yuants/protocol](libraries/protocol) Network protocol, service definition and infrastruture.
- [@yuants/utils](libraries/utils) Some general utils that is not found in community.
- [@yuants/kernel](libraries/kernel) The kernel of Time-Machine. Time-Machine can travel from the history to the future. This package also contains some useful units and scenes.
- [@yuants/agent](libraries/agent) Agent is a trading bot. Agent is the core of trading strategy.

### Plan to open source

- [ ] Some applications (host, market-data-collector, agent-daemon, trade-copier, notifier, and so on);
- [ ] The Yuan GUI;

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions make the open-source community a fantastic place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply [open a feature request issue](https://github.com/No-Trade-No-Life/Yuan/issues/new?assignees=&labels=type%2Ffeature+%F0%9F%92%A1&projects=&template=feature_request.yaml&title=feat%3A+%3Ctitle%3E).
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributors

Thanks sincerely to the contributors:

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

- Join Discord server: [![Discord](https://img.shields.io/discord/1141802173676654675?style=for-the-badge&logo=discord)](https://discord.gg/BRH2447DUV)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments 📖

1. [Yuan-Public-Workspace](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
   You can learn how to write strategy models from this repository. You can easily import it to your workspace from the GUI. The repository is embedded in AI with a vector database.
   Contribute with your examples is greatly appreciated!
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
