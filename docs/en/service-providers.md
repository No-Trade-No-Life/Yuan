# Service Providers

Service providers are connectors to external systems that interact with Yuan. These systems are independent of Yuan and independently generate new data.

Service providers are responsible for proxying requests and responses to external systems. They can be exchanges, data sources, or any other form of external service. Service providers store data in local storage and communicate with other terminals through the RPC framework.

Service providers include exchanges, data sources, or any other form of data and external services. Therefore, Yuan's capabilities increase as the capabilities of service providers expand.

You can access global markets through various service providers. Each service provider is a gateway that directly connects to external services. Your private data, including account information and market data, is not stored in Yuan cloud services. You can deploy vendors on your own cloud or local machine. This data is only stored in the storage within your host.

## Exchange Providers

### [@yuants/vendor-ctp](./packages/yuants-vendor-ctp.md)

This connects to the "Comprehensive Transaction Platform" (CTP). The CTP platform is developed by the Shanghai Futures Exchange (SHFE). CTP provides Chinese futures exchanges. To comply with regulations, you may need to request permission from your brokerage.

### [@yuants/vendor-ccxt](./packages/yuants-vendor-ccxt.md)

This connects to the "CryptoCurrency eXchange Trading Library" (CCXT). CCXT is a JavaScript / Python / PHP cryptocurrency trading library that supports many cryptocurrency exchanges and trading markets. You can use it for cryptocurrency trading.

### [@yuants/vendor-binance](./packages/yuants-vendor-binance.md)

This connects to _Binance_, a well-known cryptocurrency exchange.

### [@yuants/vendor-okx](./packages/yuants-vendor-okx.md)

This connects to _OKX_, a well-known cryptocurrency exchange.

### [@yuants/vendor-huobi](./packages/yuants-vendor-huobi.md)

This connects to _Huobi_, a well-known cryptocurrency exchange.

### [@yuants/vendor-gate](./packages/yuants-vendor-gate.md)

This connects to _Gate_, a well-known cryptocurrency exchange.

### [@yuants/vendor-bitget](./packages/yuants-vendor-bitget.md)

This connects to _BitGet_, a well-known cryptocurrency exchange.

### [@yuants/vendor-coinex](./packages/yuants-vendor-coinex.md)

This connects to _CoinEX_, a well-known cryptocurrency exchange.

### [@yuants/vendor-hyperliquid](./packages/yuants-vendor-hyperliquid.md)

This connects to _Hyperliquid_, a well-known on-chain cryptocurrency exchange.

## Data and Service Providers

### [@yuants/vendor-trading-view](./packages/yuants-vendor-trading-view.md)

This connects to _TradingView_, a well-known financial charting and trading platform. It allows you to use TradingView's charts and indicators.

### [@yuants/vendor-tq](./packages/yuants-vendor-tq.md)

This connects to _TQ_, a well-known financial data provider. It allows you to use TQ's data.

## Notification Services

### [@yuants/app-email-notifier](./packages/yuants-app-email-notifier.md)

Email notification service supporting SMTP / IMAP protocols. It allows you to send notifications via email and automatically store email content in storage.

### [@yuants/app-feishu-notifier](./packages/yuants-app-feishu-notifier.md)

Connects to Feishu, integrating with the Feishu bot system. It allows you to send notifications via Feishu, etc.

### [@yuants/app-openai](./packages/yuants-app-openai.md)

This deploys a terminal as an OpenAI service. It allows you to use OpenAI's API to generate text, images, etc.

### [@yuants/app-telegram-monitor](./packages/yuants-app-telegram-monitor.md)

This deploys a terminal as a Telegram monitoring service. It allows you to monitor Telegram messages and send them to other terminals.

## Deployment Advantages

- **Privacy Protection**: Your private data is not stored in Yuan cloud services
- **Flexible Deployment**: Can deploy vendors on your own cloud or local machine
- **Data Control**: Data is only stored in the storage within your host
- **Global Coverage**: Supports multiple markets and exchanges

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
