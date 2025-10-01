---
sidebar_position: 1
---

# 什么是供应商

供应商 (Vendor) 是 Yuan 中的一种拓展程序 (Extension)，它连接 Yuan 和外部系统，充当了 Yuan 和外部系统之间的桥梁。

供应商将 Yuan 的标准概念映射到外部系统的概念，使得 Yuan 可以与外部系统进行交互。

编写供应商需要开发者同时了解 Yuan 的标准概念，以及外部系统的概念以及对应的 API。

通常而言，供应商具体是指交易所 (Exchange) 和数据源 (Data Source)。很多交易所同时也是数据源，因此一个供应商程序可以同时是交易所和数据源。

本指南将介绍供应商的基本概念，以及如何编写供应商。

## 供应商的职责

一个供应商程序可以负责多个产品和多个账户。

- [提供产品规格](./vendor-product)
- [提供历史行情数据](./vendor-historical-market-data)
- [提供实时账户信息](./vendor-account-info)
- [提供历史订单信息](./vendor-historical-order)
- [提供交易接口 (下单、改单、撤单)](./vendor-trading-interfaces)
- [提供转账接口 (发送、查收)](./vendor-transfer)

## 外部系统的接口类别

外部系统的接口类型五花八门，但大致可以分为以下几类：

1. HTTP API (包括 WebSocket，因为 WebSocket 是基于 HTTP 协议的)

   基于 HTTP 协议的 API 是兼容性最好的，因为几乎所有的编程语言都有 HTTP 请求库。并且，在浏览器中也可以使用。

2. Node.js Lib (例如需要用到 Raw Socket、 C++ Addon 或者 N-API 绑定)

   只有 Node.js 程序可以使用的库，通常是基于 C++ 的 Addon，或者是使用 N-API 与其他语言绑定。

   难度适中，只需要额外安装一个 npm 包即可接入。

3. 跨语言互操作 SDK (例如 C++ 的 DLL)

   一些外部系统可能只提供了 C++ 的 SDK，自己编写绑定比较困难，此时建议使用嵌入式消息队列 [ZeroMQ](https://zeromq.org/) 进行跨语言互操作。

   难度较大，建议阅读我们的最佳实践 - [跨语言互操作指南](./cross-language-interoperability)。

4. 图形用户接口 (包括 Web GUI, Native GUI)

   一些外部系统可能只提供了图形用户接口，此时需要使用自动化测试工具进行模拟操作。但是这种方式的资源占用度较高，且可能涉及对外部系统的侵权行为。仅推荐在没有其他办法的情况下使用。您可以学习 Puppeteer、Selenium、WinAppDriver 等自动化测试工具。

<!-- ## 开始实现供应商

一个供应商程序通常是一个 Node.js 程序，它需要使用终端 (Terminal) 与主机中的其他终端通讯。

:::info[供应商可以在浏览器中运行吗？]
可以，但不推荐。

因为它最后需要以守护进程的形式运行，提供服务。

而浏览器存在"后台时钟冻结"、"资源占用高"等原因，不适合作为守护进程运行。
:::

```ts
import { Terminal } from '@yuants/protocol';

const terminal = Terminal.fromNodeEnv();
``` -->
