---
sidebar_position: 4
---

# Orders

**Orders** refer to the buy or sell instructions submitted by investors to the exchange. Orders are the starting point of trading. The purpose of an order is to modify an account.

Standardizing orders can be challenging. The fields and statuses of orders may vary across different exchanges and products.

Orders are essentially trading instructions, which are intelligent programs with specific purposes. For centralized exchanges, the execution of orders is handled by the exchange. For decentralized exchanges, the execution is managed by smart contracts, marked by consensus among validator nodes and blockchain confirmation.

For simple orders, specifying the product, direction, quantity, and price is sufficient. However, complex orders may require additional fields such as stop loss, take profit, validity period, etc.

An order is a delegation action, from the creation of the order to the complete execution or cancellation of the delegated quantity.

<!-- Some exchanges may confuse the concepts of orders and positions. -->

## Order Purpose

The trading purpose of an order means what changes will occur in the account once the order is successfully executed.

- Trading object: Which account? Which product? Even which position?
- Trading direction: Buy or sell? Open or close a position?
- Trading quantity: How much to buy or sell?

### Trading Object

The trading object refers to the target of the order. The target can be an account, product, position, etc.

- The order specifies the trading object with the `account_id` field. `account_id` is the unique identifier of the account.
- The order specifies the product with the `product_id` field. `product_id` is the unique identifier of the product.
- The order specifies the position with the `position_id` field. `position_id` is the unique identifier of the position.

### Trading Direction

When going long, profits are made if the price rises; when going short, profits are made if the price falls.

In general contexts, buying and going long mean the same thing. Due to the existence of short contracts, buying short contracts is no longer considered going long.

This indicates that buying and selling can be ambiguous, while going long and going short are not.

Currently, there are only four possible values for the order direction:

- `"OPEN_LONG"`: Open long, establish a long position
- `"OPEN_SHORT"`: Open short, establish a short position
- `"CLOSE_LONG"`: Close long, exit a long position
- `"CLOSE_SHORT"`: Close short, exit a short position

:::note[Why not use two products to represent long and short positions separately?]
Because there is no gain in information efficiency.

Theoretically, going short is buying a bearish contract, essentially still buying a paper contract. Following this logic, designing two different products to represent long and short positions is logically feasible, simplifying the order direction field to buy and sell.

For example, since each product has its own quotes and historical data, using two products to represent long and short positions would result in two different quotes. This could lead to storing a product's historical quotes twice, causing data redundancy. Alternatively, a new field would need to be introduced to address this issue, involving some join operations, making it more complex. Overall, the cost is high, and the benefit is merely simplifying a 4-value field to a 2-value field.
:::

:::note[Why are call and put options for options contracts separate products?]
Because they indeed have different quote histories.

For example, the quotes for BTC-USDT CALL @ 60000 and BTC-USDT PUT @ 60000 are indeed different. This involves the intrinsic and extrinsic value of options, the pricing logic of options, which we won't delve into here.
:::

:::note[Why use string enum values instead of numeric enum values?]
Modern computers and programming languages are powerful enough that string enum values can be used within acceptable space and indexing efficiency costs. String enum values significantly improve **readability** compared to traditional numeric enum values. They are beneficial for front-end display and can be directly shown to users. They are also more open to expansion, allowing for more enum values to accommodate future changes.
:::

### Trading Quantity

The trading quantity refers to the amount of the order. The quantity of an order is a positive number. Negative numbers and zero are illegal values.

- The quantity of the order is specified with the `volume` field. This is a positive number and can be a decimal.

The value of the trading quantity is specified by the relevant product specifications. Please refer to the [Product](./what-is-product.md) section for related content.

:::note[Why not use negative numbers and zero?]
This is a constraint deliberately created to detect unnecessary errors.
For example, if a user's strategy results in a negative order due to some calculation error, this might not be the user's intention but could have severe consequences.
:::

## Order Execution

### Order Types

The order type determines how the order is executed.

- `"LIMIT"`: Limit order, buy or sell at a specified price

  Limit orders are the most basic type of order. Other types of orders can be simulated using limit orders.

  The `price` field must be specified.

  In a long limit order, if the price is below the order price, the order will be executed immediately;
  in a short limit order, if the price is above the order price, the order will be executed immediately.

- `"MARKET"`: Market order, buy or sell at the best market price

  Market orders are the most common type of order. The characteristic of a market order is immediate execution, but the execution price is uncertain.

  A buy market order can be equivalent to a limit order with a significantly high price;
  a sell market order can be equivalent to a limit order with a significantly low price.

- `"STOP"`: Stop/loss order, buy or sell when the price reaches a specified price

  Stop/loss orders are protective order types. When the price reaches the specified price, the order will be executed immediately.

  The `price` field must be specified.

  In a long stop order, if the price is above the order price, the order will be executed immediately;
  in a short stop order, if the price is below the order price, the order will be executed immediately.

### Common Trading Mechanisms

In trading, the most commonly used mechanisms are **Central Limit Order Book (CLOB)** and **Liquidity Pools (LP)**. However, there are several other trading and liquidity provision mechanisms used in different trading scenarios and platforms. It is necessary to introduce them to broaden our perspective and better understand the concept of order standardization. For example, CLOB supports limit orders but may not support market orders. LP supports market orders but may not support limit orders.

**CLOB** (Central Limit Order Book):
CLOB is the most common trading mechanism in traditional exchanges. It matches buy and sell orders through a centralized order book. Each order has a specific price and quantity, and the system matches trades based on price priority and time priority.

**LP** (Liquidity Pools):
Liquidity pools are usually associated with "Automated Market Makers" (AMM). Liquidity pools are funds provided by users to support trading of specific assets. In AMM, liquidity pools are used to automatically calculate asset prices and execute trades.

:::note[Other Trading Mechanisms]
RFQ (Request for Quote):
RFQ is a trading mechanism where traders request quotes for specific assets from liquidity providers (usually market makers or professional trading companies). Liquidity providers then offer buy and sell prices, and traders can decide whether to trade based on these quotes. This mechanism is common in the foreign exchange market and large transactions. For example, banks and MetaTrader 4/5. For general traders, RFQ can be considered a simplified version of CLOB.

P2P (Peer-to-Peer):
P2P trading allows users to trade directly with other users instead of through a centralized exchange or market maker. This trading method is particularly popular in the cryptocurrency field, offering higher privacy and autonomy. For example, Bitcoin OTC trading, and more broadly, e-commerce platforms can be considered as such.

Auction-Based Models:
In auction-based models, the price of an asset is determined through an auction process. This mechanism is common in the initial trading of newly issued assets, such as IPOs (Initial Public Offerings) or ICOs (Initial Coin Offerings).
:::

### Order Status

The order status is the internal status of the order in the exchange. By obtaining the most basic order status from the exchange's interface, we can understand the execution status of the order without adding extra states.

- `"ONGOING"`: Accepted, the order has been accepted by the exchange and is waiting to be executed. The order is in an ongoing state and may affect the account.
- `"COMPLETE"`: Completed, the order has been fully executed or canceled. The order is in a completed state and no longer affects the account.
- `"ERROR"`: Error, the order has encountered an error, possibly due to parameter issues, unreasonable price, unreasonable quantity, etc., requiring external intervention to fix the error.

:::note[Why is there no order status for "partially filled"?]
Because partial execution is equivalent to "executed volume" being less than "delegated volume," and the order is in a completed state.
We do not need an additional status to represent partial execution.
:::

:::note[Why is there no order status for "canceled"?]
Because we do not care about canceled orders.
Cancellation is a type of completion, just with a different reason.
Canceled orders do not affect the account or the exchange.
:::

:::note[Why is there no order status for "expired"?]
Expired orders are equivalent to canceled orders, just with a different reason.
:::

### Execution Result

The result of the order is the executed price and quantity.

- The executed volume of the order is specified with the `traded_volume` field. This is a positive number and can be a decimal.
- The average executed price of the order is specified with the `traded_price` field. This price is not limited by the product's `price_step`.

### Trading Time

There are several key time points in the execution of an order. Creation time, submission time, complete execution time, cancellation time, completion time, last update time, etc.

However, the exchange's interface may not return all time points. Therefore, we need to assume that some time point information is missing.

## Complete Order Fields

| Field Name        | Description                                                                    | Example Value        |
| :---------------- | :----------------------------------------------------------------------------- | :------------------- |
| `order_id`        | Order ID                                                                       | `"12398174263"`      |
| `account_id`      | [Account](./what-is-account.md) ID (Required)                                  | `"Some-Account-ID"`  |
| `product_id`      | [Product](./what-is-product.md) ID (Required)                                  | `"XAUUSD"`           |
| `position_id`     | Specified position ID, if specified, can only trade the corresponding position | `"Some-Position-ID"` |
| `order_direction` | Order direction                                                                | `"OPEN_LONG"`        |
| `volume`          | Delegated volume                                                               | `3`                  |
| `order_type`      | Order type                                                                     | `"MARKET"`           |
| `price`           | Delegated price                                                                | `1762.23`            |
| `traded_volume`   | Executed volume                                                                | `2`                  |
| `traded_price`    | Average executed price                                                         | `1762.23`            |
| `order_status`    | Order status                                                                   | `"ACCEPTED"`         |
| `submitted_at`    | Delegation timestamp (Unix millisecond style)                                  | `1722104965015`      |
| `filled_at`       | Complete execution timestamp (Unix millisecond style)                          | `1722104965015`      |
| `comment`         | Comment                                                                        | `"Powered by Yuan"`  |
