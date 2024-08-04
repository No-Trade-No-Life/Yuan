# Market Data

Market Data refers to information that is highly time-sensitive and independent of the user. It represents the knowledge acquired by a user after a certain point in time, which could be the price at a specific moment or statistical data over a period. Market Data comes in various forms, including OHLC-V, tick-by-tick trades, product market summaries, order books, and financial events.

Market Data can be categorized into Instant Market Data and Range Market Data based on the type of time annotation. Instant Market Data represents the market data at a single point in time, while Range Market Data represents the market data over a period. Instant Market Data can be considered as Range Market Data with identical start and end times. In most cases, Range Market Data refers to statistical data over a period that is retrospectively reviewed after the end time, making it essentially a special form of Instant Market Data. However, we still conceptually distinguish between the two for intuitive clarity.

Based on data timeliness, Market Data is divided into Real-time Market Data and Historical Market Data. Real-time Market Data refers to data obtained in real-time, whereas Historical Market Data refers to data from a past period. Real-time data is used in live trading and monitoring scenarios, while historical data is used in backtesting and analysis scenarios. Not all real-time data is saved as historical data, so the methods of obtaining historical data may vary (recording or pulling from the data source).

Data mutability refers to whether the data changes over time. If all data in the system is required to be immutable, it demands high computational resources and high-quality data sources, which is challenging to achieve. Therefore, as mutable information, Market Data must have an identifier (`id`), and key time points include the time of creation (`created_at`), freezing (`frozen_at`), and observation (`updated_at`).

For large, overlapping, and complex Market Data, information can be compressed and encoded using snapshots and patches. A snapshot represents the complete data at a specific point in time, while a patch represents changes in data after a certain point in time. The combination of snapshots and patches can reconstruct a complete data stream. For example, order book data is well-suited for this type of transmission.

## Specific Market Data

### OHLC-V

OHLC-V is a market data format that includes the open, high, low, close, and volume.

Visually, OHLC-V data can be used to draw candlestick charts (K-line charts) or OHLC charts, making it a commonly used technical analysis tool.

The time period for OHLC-V can be arbitrary, such as 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour, 4 hours, 1 day, 1 week, 1 month, etc. Different time periods affect the granularity of OHLC-V; for example, 1-minute OHLC-V shows more price fluctuations, while 1-day OHLC-V shows more long-term trends. OHLC-V for periods of 1 hour or more begins to be related to time zones, so the same time period may differ in different time zones.

| Field Name   | Description                                                                                       | Example Value   |
| :----------- | :------------------------------------------------------------------------------------------------ | :-------------- |
| `product_id` | [Product](./what-is-product.md) ID                                                                | `"XAUUSD"`      |
| `duration`   | OHLC-V period defined in [RFC3339](https://datatracker.ietf.org/doc/html/rfc3339) Duration format | `"PT5M"`        |
| `opened_at`  | OHLC-V open timestamp (Unix milliseconds)                                                         | `1630000000000` |
| `closed_at`  | OHLC-V close timestamp (Unix milliseconds)                                                        | `1630000060000` |
| `open`       | Open price                                                                                        | `1490.23`       |
| `high`       | High price                                                                                        | `1500.45`       |
| `low`        | Low price                                                                                         | `1480.52`       |
| `close`      | Close price                                                                                       | `1495.46`       |
| `volume`     | Volume within the range                                                                           | `100`           |

:::info[Why do we need both period and open and close times?]
Generally, the open time + period length = close time. However, due to varying trading hours of exchanges, the difference between the open and close times may not equal the period length in some cases. Therefore, to ensure data accuracy, we need both the period and the open and close times.

For example, the trading hours of a certain exchange are from 9:30 to 11:30 and 13:00 to 15:00 on weekdays. For a 1-hour K-line, the first K-line of the day opens at 9:30 to 10:00, not 9:30 to 10:30.

Similarly, due to these special circumstances, we cannot accurately calculate the period length from the open and close times, so we need the period field to explicitly specify the period length.
:::

### Tick-by-Tick Trades

Tick-by-Tick Trades (Ticks) refer to the transaction information for each trade in the financial market. Ticks include the time, price, and quantity of the trade. Tick data is voluminous and is typically used in high-frequency trading scenarios. Tick data can be used to analyze market liquidity and price trends.

Tick data is usually obtained in real-time, so the timeliness of tick data is crucial. The method of obtaining tick data is typically through the API interface of the exchange, but different exchanges may have different data formats and interfaces.

| Field Name   | Description                               | Example Value   |
| :----------- | :---------------------------------------- | :-------------- |
| `product_id` | [Product](./what-is-product.md) ID        | `"XAUUSD"`      |
| `updated_at` | Information timestamp (Unix milliseconds) | `1630000000000` |
| `price`      | Trade price                               | `1490.23`       |
| `volume`     | Trade volume                              | `100`           |

### Product Market Summary

Product Market Summary refers to the market information of a specific product in the financial market. It includes the latest trade price, settlement price, open interest, bid/ask information, interest rates, etc. Product Market Summary data can be used to analyze market trends and risks. Unlike tick data, Product Market Summary is a snapshot overview of the entire market with lower update frequency. Historical Product Market Summary data can be stored in a database for backtesting and analysis.

| Field Name                | Description                                                          | Example Value   |
| :------------------------ | :------------------------------------------------------------------- | :-------------- |
| `product_id`              | [Product](./what-is-product.md) ID (Required)                        | `"XAUUSD"`      |
| `updated_at`              | Information timestamp (Unix milliseconds) (Required)                 | `1630000000000` |
| `last_price`              | Latest trade price                                                   | `1490.23`       |
| `settlement_price`        | Settlement price (mark price, clearing price) for position valuation | `1490.25`       |
| `open_interest`           | Total market open interest                                           | `212847`        |
| `ask_price`               | Ask price, best sell-one price                                       | `1490.25`       |
| `ask_volume`              | Best sell-one volume                                                 | `100`           |
| `bid_price`               | Bid price, best buy-one price                                        | `1490.23`       |
| `bid_volume`              | Best buy-one volume                                                  | `100`           |
| `interest_rate_for_long`  | Long position interest rate (by position value)                      | `0.0001`        |
| `interest_rate_for_short` | Short position interest rate (by position value)                     | `-0.0001`       |
| `settlement_scheduled_at` | Next settlement timestamp (Unix milliseconds)                        | `1722104965015` |

### Order Book

Order Book refers to the bid and ask information in the financial market. It includes the price and quantity of buy and sell orders. Order Book data can be used to analyze the market's bid/ask situation, support and resistance levels, etc.

Order Book data is usually obtained in real-time, so the timeliness of Order Book data is crucial. The method of obtaining Order Book data is typically through the API interface of the exchange, but different exchanges may have different data formats and interfaces.

- Order Book Snapshot represents the Order Book information at a specific point in time.
- Order Book Patch represents changes in Order Book information after a certain point in time.

Snapshots and patches share the same data structure.

| Field Name        | Description                                          | Example Value                          |
| :---------------- | :--------------------------------------------------- | :------------------------------------- |
| `product_id`      | [Product](./what-is-product.md) ID (Required)        | `"XAUUSD"`                             |
| `updated_at`      | Information timestamp (Unix milliseconds) (Required) | `1630000000000`                        |
| `prev_updated_at` | Previous message timestamp (Unix milliseconds)       | `1630000001000`                        |
| `asks`            | Ask information (Required)                           | `[{price: 1490.25, volume: 100}, ...]` |
| `bids`            | Bid information (Required)                           | `[{price: 1490.23, volume: 100}, ...]` |

:::info[How to maintain a local order book copy?]

1. Subscribe to the Order Book Patch channel.
1. Upon receiving the first patch data, start caching it into a list.
1. Request an Order Book Snapshot.
1. Discard the patch information cached earlier than the snapshot.
1. Replace the local copy with the snapshot and continue updating the local copy from the remaining undiscarded patches.
1. If the `prev_updated_at` of the patch stream does not equal the `updated_at` of the previous patch, it indicates a possible packet loss, and an exception should be thrown.
1. Each order quantity in the snapshot represents the absolute value of the current order quantity at that price, not a relative change.
1. If the order quantity for a certain price is 0, it indicates that the order at that price has been canceled or filled, and that price level should be removed.

:::
