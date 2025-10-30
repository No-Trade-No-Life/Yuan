# Trading Execution

Agents are responsible for outputting simulated account positions in real-time, but they don't directly interact with the market. This is to maintain statelessness and simplify agent logic.

We use an account composer to combine simulated account information to obtain the planned account information required for live trading. Then, we use a trade copier to ensure that the positions of the real trading account remain consistent with the planned account positions.

## Core Components

### [@yuants/app-account-composer](./packages/@yuants-app-account-composer.md)

Account composer. It can derive new account information from several accounts. It has wide applications and can merge accounts from multiple agents into one account.

### [@yuants/app-trade-copier](./packages/@yuants-app-trade-copier.md)

Trade copier. It **sends orders to the market** to ensure that the real account follows the planned account, with the goal of keeping their positions consistent. Supports configuring multiple micro-strategies, such as market price chasing, limiting single trade volume, rolling optimal pending orders, etc. Of course, you can also use one real account to follow another real account.

### [@yuants/app-transfer-controller](./packages/@yuants-app-transfer-controller.md)

The transfer controller is a service that transfers funds between accounts. It monitors transfer requests and ensures transfers are completed.

### [@yuants/app-risk-manager](./packages/@yuants-app-risk-manager.md)

This deploys a terminal as a risk manager. It makes transfer decisions based on configured risk information.

## Execution Process

1. **Position Calculation**: Agents output simulated account positions
2. **Account Composition**: Account composer merges multiple account information
3. **Plan Generation**: Generate planned account for live trading
4. **Copy Trading Execution**: Trade copier ensures real account follows planned account
5. **Risk Control**: Risk manager monitors and controls risk

## Copy Trading Strategies

### Market Price Chasing

- Use market orders to quickly establish positions
- Suitable for markets with good liquidity
- Fast execution speed, but may have slippage

### Limit Single Trade Volume

- Limit the maximum volume per trade
- Avoid excessive market impact
- Suitable for large trades

### Rolling Optimal Pending Orders

- Place orders at optimal price levels
- Adjust order prices as market changes
- Pursue better execution prices

## Fund Management

### Transfer Control

- Securely transfer funds between accounts
- Monitor transfer request status
- Ensure transfers are completed

### Risk Control

- Make decisions based on risk configuration
- Monitor account risk levels
- Automatically balance fund allocation

### Logistics Network

- Automatically balance funds between different accounts according to strategy
- Optimize fund utilization efficiency
- Reduce overall risk

## Design Advantages

- **Stateless Agents**: Simplify strategy logic, improve reliability
- **Flexible Composition**: Support various account combination methods
- **Intelligent Copy Trading**: Multiple copy trading strategies adapt to different markets
- **Comprehensive Risk Control**: Multi-level risk control mechanisms

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
