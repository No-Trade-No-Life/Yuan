# 服务提供商

服务提供商是指与 Yuan 交互的外部系统的连接器。这些系统独立于 Yuan，并且会独立产生新的数据。

服务提供商负责向外部系统代理请求和响应。它们可以是交易所、数据源或其他任何形式的外部服务。服务提供商会将数据存储在本地存储中，并通过 RPC 框架与其他终端进行通信。

服务提供商包括交易所、数据源，或者其他任何形式的数据和外部服务。因此，Yuan 的能力会随着服务提供商能力的增加而增强。

您可以通过各种服务提供商访问全球市场。每个服务提供商都是直接连接外部服务的网关。您的私人数据，包括账户信息和市场数据，不会存储在 Yuan 云服务中。您可以在自己的云或本地机器上部署供应商。这些数据仅会存储在您主机内的存储中。

## 交易所提供商

### [@yuants/vendor-ctp](./packages/yuants-vendor-ctp.md)

这连接到"综合交易平台"（CTP）。CTP 平台由上海期货交易所（SHFE）开发。CTP 提供中国的期货交易所。为了遵守法规，您可能需要从您的经纪公司请求许可。

### [@yuants/vendor-ccxt](./packages/yuants-vendor-ccxt.md)

这连接到"加密货币交易所交易库"（CCXT）。CCXT 是一个支持许多加密货币交易所和交易市场的 JavaScript / Python / PHP 加密货币交易库。您可以使用它进行加密货币交易。

### [@yuants/vendor-binance](./packages/yuants-vendor-binance.md)

这连接到 _Binance_，这是一个著名的加密货币交易所。

### [@yuants/vendor-okx](./packages/yuants-vendor-okx.md)

这连接到 _OKX_，这是一个著名的加密货币交易所。

### [@yuants/vendor-huobi](./packages/yuants-vendor-huobi.md)

这连接到 _Huobi_，这是一个著名的加密货币交易所。

### [@yuants/vendor-gate](./packages/yuants-vendor-gate.md)

这连接到 _Gate_，这是一个著名的加密货币交易所。

### [@yuants/vendor-bitget](./packages/yuants-vendor-bitget.md)

这连接到 _BitGet_，这是一个著名的加密货币交易所。

### [@yuants/vendor-coinex](./packages/yuants-vendor-coinex.md)

这连接到 _CoinEX_，这是一个著名的加密货币交易所。

### [@yuants/vendor-hyperliquid](./packages/yuants-vendor-hyperliquid.md)

这连接到 _Hyperliquid_，这是一个著名的链上加密货币交易所。

## 数据和服务提供商

### [@yuants/vendor-trading-view](./packages/yuants-vendor-trading-view.md)

这连接到 _TradingView_，这是一个著名的金融图表和交易平台。它允许您使用 TradingView 的图表和指标。

### [@yuants/vendor-tq](./packages/yuants-vendor-tq.md)

这连接到 _TQ_，这是一个著名的金融数据提供商。它允许您使用 TQ 的数据。

## 通知服务

### [@yuants/app-email-notifier](./packages/yuants-app-email-notifier.md)

支持 SMTP / IMAP 协议的电子邮件通知服务。它允许您通过电子邮件发送通知，并将邮件内容自动存入存储。

### [@yuants/app-feishu-notifier](./packages/yuants-app-feishu-notifier.md)

连接到飞书，接入飞书机器人体系。它允许您通过飞书发送通知等。

### [@yuants/app-openai](./packages/yuants-app-openai.md)

这将部署一个终端作为 OpenAI 服务。它允许您使用 OpenAI 的 API 来生成文本、图像等。

### [@yuants/app-telegram-monitor](./packages/yuants-app-telegram-monitor.md)

这将部署一个终端作为 Telegram 监控服务。它允许您监控 Telegram 消息，并将其发送到其他终端。

## 部署优势

- **隐私保护**: 您的私人数据不会存储在 Yuan 云服务中
- **灵活部署**: 可以在自己的云或本地机器上部署供应商
- **数据控制**: 数据仅存储在您主机内的存储中
- **全球覆盖**: 支持多种市场和交易所

<p align="right">(<a href="../../README.md">返回 README</a>) | <a href="architecture-overview.md">架构概述</a></p>
