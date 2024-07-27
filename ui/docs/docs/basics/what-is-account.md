---
sidebar_position: 3
---

# What is an Account

You may have used a "bank account" before. It is essentially a simplified version of an account, involving only changes in balance.

Now, we introduce a broader concept of **account**:

An account includes **currency (Currency)** and **positions (Position)**.

- Currency is an asset that can be directly transferred and used for transactions; since currency may be obtained through transfers, its cost cannot be known, and thus its profit and loss cannot be calculated.
- Positions include foreign exchange, stocks, commodities, bonds, etc. Any assets that you consider will eventually be converted into currency for sale belong to your positions. Positions have a shorter lifecycle than currency, can have their cost known, and can have profit and loss attributes calculated.

## Currency

Currency is described as a type of currency and several different amounts. An account can simultaneously hold multiple currencies.

| Field Name | Description                                                                      | Example Value |
| :--------- | :------------------------------------------------------------------------------- | :------------ |
| `currency` | Currency name                                                                    | `"USD"`       |
| `balance`  | Balance                                                                          | `10000`       |
| `free`     | Available balance, the portion that can be transferred out through transfers     | `9000`        |
| `equity`   | Net worth, equity, the expected balance if all positions are exited              | `15000`       |
| `profit`   | Floating profit and loss of related positions                                    | `5000`        |
| `used`     | Used margin, the frozen portion that cannot be transferred out through transfers | `6000`        |

This equation always holds: `equity` = `balance` + `profit` = `used` + `free`

The floating profit and loss of an account is necessarily the sum of the floating profit and loss of each position in the account.

The used margin of an account is usually the sum of the used margin of each position in the account (under a joint margin system, this is usually not the case), and is directly provided by the clearing house.

The calculation method is typically:

1. Calculate the floating profit and loss using positions
2. Calculate the net worth using the balance and floating profit and loss
3. Calculate the available balance using the net worth and used margin

**There are only two ways to change the account balance**:

1. **Trading**: The account's positions will profit or lose due to market price changes, and events such as opening positions, closing positions, and interest settlement can change the account balance.
2. **Transferring**: The transfer of currency between accounts. Specifically, this refers to deposits and withdrawals.

### Standard Currency

An account can hold multiple different currencies. When valuing an account in total, it is common to adopt a standard perspective, converting all different currencies into a single currency-denominated valuation based on market prices.

We believe that the standard is something that needs to be aggregated from the frontend perspective, so during the production process of account information, there is no need to pre-specify which currency is the standard currency.

## Positions

Each account can hold several positions. Positions can also be called positions.

| Field Name                | Description                                         | Example Value       |
| :------------------------ | :-------------------------------------------------- | :------------------ |
| `position_id`             | Position ID (required)                              | `"1235123"`         |
| `product_id`              | Product ID (required)                               | `XAUUSD`            |
| `direction`               | Position direction (required)                       | `"SHORT"`           |
| `volume`                  | Position volume (required)                          | `5`                 |
| `free_volume`             | Volume available for trading                        | `1`                 |
| `position_price`          | Position cost price (required)                      | `1490`              |
| `closable_price`          | Market closing price (required)                     | `2500`              |
| `floating_profit`         | Floating profit and loss (required)                 | `149`               |
| `comment`                 | Position comment                                    | `"Powered by Yuan"` |
| `valuation`               | Position valuation (required)                       | `1250000`           |
| `settlement_scheduled_at` | Next settlement timestamp (Unix millisecond style)  | `1722104965015`     |
| `interest_to_settle`      | Expected interest to be received at next settlement | `-2.21`             |

## Trading

Account trading involves five basic variables: balance, floating profit and loss (floating PnL), equity, used margin, and available margin.

1. First, the account will have a balance, which is a basic variable not dependent on other variables.
2. Then select a [product](./what-is-product.md).
3. You can submit a trading order to the exchange to prepare to establish a position.
4. When establishing a position, you need to pay a certain amount of margin. (**Available margin** will be converted to **Used margin**)
5. During price changes, the floating profit and loss caused by price differences will change in real time.
6. Then you can choose to exit the position at a certain market price and time, and the floating profit and loss will be converted to the balance.
7. In this way, the account balance can be accumulated.

### How to Calculate Margin

The principle is that the larger the position, the greater the risk, and the more margin required, usually positively correlated with the position quantity. When the available margin is insufficient, the exchange will **reject** opening a position. The specific calculation method depends on the exchange rules.

See [How to Calculate Margin](../reference/how-to-calculate-margin.md)

### How to Calculate Profit and Loss

Profit and loss is usually caused by market value changes and interest settlement events.

See [How to Calculate Profit and Loss](../reference/how-to-calculate-pnl.md)
