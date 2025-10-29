# Data Modeling

To unify global markets, we need a general data model to represent market data. This data model helps us perform data conversion and mapping between different markets.

Data modeling includes common code such as TypeScript types, utilities, etc.

## Core Data Models

### [@yuants/data-product](libraries/data-product)

Tradable products in the market.

### [@yuants/data-ohlc](libraries/data-ohlc)

OHLC(V) data. OHLC stands for Open, High, Low, Close, which is a common market data format, also known as K-line.

### [@yuants/data-quote](libraries/data-quote)

Level-1 quote data, specifically referring to a product's latest price and best bid/ask information.

### [@yuants/data-interest-rate](libraries/data-interest-rate)

Interest rate data. Interest rate refers to the interest generated when a trader holds a position through settlement points. It's commonly used in forex trading and CFD (Contract for Difference) trading, and also applies to perpetual contract funding rates.

### [@yuants/data-account](libraries/data-account)

Account and position information.

### [@yuants/data-order](libraries/data-order)

Order data. Orders refer to buy or sell instructions submitted by traders in the market.

### [@yuants/data-trade](libraries/data-trade)

Trade data. Trades refer to the results of orders being executed in the market.

Additionally, private data modeling that doesn't need to be shared between packages is placed in the corresponding domain packages.

## Data Characteristics

We've identified two very useful properties of data: hierarchical attributes and time series properties.

### Hierarchical Attributes

- Product hierarchy originates from different markets and various categories of instruments
- Account information hierarchy comes from different brokers, parent-child account relationships, fund component relationships, etc.
- Hierarchical attributes allow storing and managing very large amounts of data
- Hierarchy is very intuitive to understand, as you only need to work within one subdirectory at a time

### Time Series Properties

- Data is typically generated over time and continuously aggregated by time periods
- For example, with OHLC data, we can leverage time series characteristics for data management across different time slices
- Collect data from data providers by period and store it in the database
- Time series data storage and querying are very efficient

## Design Advantages

- Unified data model supports global markets
- Hierarchical structure facilitates data organization and management
- Time series characteristics optimize data storage and querying
- Modular design facilitates extension and maintenance

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
