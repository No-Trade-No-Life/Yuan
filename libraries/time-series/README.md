# @yuants/time-series

A reactive time series library for financial data analysis and technical indicators.

## Overview

`@yuants/time-series` provides a reactive framework for working with time series data, particularly designed for financial applications. It features automatic dependency tracking, lazy evaluation, and built-in technical indicators.

## Installation

```bash
npm install @yuants/time-series
```

## Core Concepts

### TimeFrame

The `TimeFrame` is the central container that manages all time series data. It ensures that all series within the same timeframe are synchronized.

```typescript
import { TimeFrame } from '@yuants/time-series';

const tf = new TimeFrame();
```

### TimeSeries

A `TimeSeries` is a reactive array-like object that represents a sequence of values over time. Each series belongs to a `TimeFrame` and can have tags for identification.

```typescript
const price = tf.createTimeSeries<number>({ id: 'price' });
const volume = tf.createTimeSeries<number>({ id: 'volume' });
```

## Key Features

### Reactive Computation

The library uses a reactive computation model where derived series automatically update when source data changes.

### Lazy Evaluation

Computations are performed only when needed, improving performance for large datasets.

### Technical Indicators

Built-in technical indicators including:

- **SMA** (Simple Moving Average)
- **EMA** (Exponential Moving Average)
- **RSI** (Relative Strength Index)
- **MACD** (Moving Average Convergence Divergence)
- **BB** (Bollinger Bands)
- **ATR** (Average True Range)
- **Stochastic** (Stochastic Oscillator)

### Data Combination and Scanning

- `combine()`: Combine multiple series using a mapping function
- `scan()`: Perform cumulative operations (like reduce) over time

## Usage Examples

### Basic Setup

```typescript
import { TimeFrame, SMA, EMA, combine, scan } from '@yuants/time-series';

const tf = new TimeFrame();
const price = tf.createTimeSeries<number>({ id: 'price' });
const volume = tf.createTimeSeries<number>({ id: 'volume' });

// Add some data
price[0] = 100;
price[1] = 102;
price[2] = 101;
volume[0] = 1000;
volume[1] = 1200;
volume[2] = 1100;

tf.commit();
```

### Technical Indicators

```typescript
// Calculate moving averages
const sma10 = SMA(price, 10);
const ema10 = EMA(price, 10);

// Create a signal based on indicator comparison
const signal = combine({ id: 'signal' }, (i) => (sma10[i] > ema10[i] ? 1 : 0), [sma10, ema10]);

// Calculate RSI
const rsi14 = RSI(price, 14);

// Calculate MACD
const { macdLine, signalLine, histogram } = MACD(price);

// Calculate Bollinger Bands
const { middleBand, upperBand, lowerBand } = BB(price);

// Calculate ATR (requires OHLC data)
const atr14 = ATR(high, low, close, 14);

// Calculate Stochastic Oscillator
const { kLine, dLine } = Stochastic(high, low, close);
```

### Advanced Operations

```typescript
// Create a volume-at-price map using scan
const VaP = scan(
  { id: 'VaP' },
  () => new Map<number, number>(),
  (acc, i) => acc.set(price[i], volume[i]),
  [price, volume],
);

// Create a series that references future values
const futurePrice = tf.createTimeSeries<number>({ id: 'future-5' }, () => {
  const pivot = price.cleanLength();
  for (let i = 0; i < tf.time.length; i++) {
    futurePrice[i] = price[i + 5];
  }
});
```

### Data Export

```typescript
// Export to CSV format
const csvData = [
  tf.list.map((s) => s.tags.id).join(','),
  ...tf.time.map((t, i) => tf.list.map((ts) => ts[i]).join(',')),
].join('\n');
```

## API Reference

### TimeFrame

- `createTimeSeries<T>(tags, onCalc?)`: Create a new time series
- `commit()`: Commit all changes and trigger calculations
- `list`: Readonly array of all time series
- `time`: The main time series

### TimeSeries

- `tags`: Metadata tags for identification
- `timeFrame`: Reference to the parent timeframe
- `cleanLength()`: Get the length of clean data after last commit
- `commit()`: Commit changes to this series
- `calc()`: Trigger calculation for this series

### Functions

- `combine(tags, mapper, sources)`: Combine multiple series
- `scan(tags, init, reducer, sources)`: Perform cumulative operations
- `SMA(source, length)`: Simple Moving Average
- `EMA(source, length)`: Exponential Moving Average
- `RSI(source, length)`: Relative Strength Index
- `MACD(source, fastLength?, slowLength?, signalLength?)`: Moving Average Convergence Divergence
- `BB(source, length?, stdDev?)`: Bollinger Bands
- `ATR(high, low, close, length?)`: Average True Range
- `Stochastic(high, low, close, kPeriod?, dPeriod?)`: Stochastic Oscillator

## Performance Characteristics

- **Lazy Evaluation**: Computations are performed only when data is accessed
- **Incremental Updates**: Only recalculates from the pivot index forward
- **Memory Efficient**: Uses JavaScript Proxy for reactive behavior

## Development

### Building

```bash
npm run build
```

### Testing

The library includes comprehensive test coverage to ensure reliability.

## License

This project is part of the Yuan ecosystem. See the main project repository for license information.
