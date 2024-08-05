# Providing Historical Market Data

[Market data](../basics/what-is-market-data) comes in several different specific types, but they can all be summarized as queries for a specific type, within a specific time range, and for a specific sequence.

```ts
import { Terminal, provideSeriesData } from '@yuants/protocol';

const terminal = new Terminal(process.env.HOST_URL!, {});

provideDataSeries(
  terminal,
  {
    // Type of the data series
    type: 'ohlc',
    // Regular expression for the data series, matching Series IDs will be passed to the callback function
    pattern: `^${VENDOR_NAME}/`,
  },
  async (series_id, [from, to]) => {
    // Parse the product ID and duration from the Series ID
    const [, product_id, duration] = decodePath(series_id);
    // Fetch OHLC data from an external system (to be implemented by the provider)
    const res = await Api.getOHLC(product_id, duration, from, to);
    // Convert to Yuan's OHLC-V data
    return res.map((x) => ({
      product_id,
      duration,
      opened_at: x.t,
      closed_at: inferClosedAt(x.t, duration), // Calculate the closing time (flexibly handled according to market rules)
      open: x.o,
      high: x.h,
      low: x.l,
      close: x.c,
      volume: x.v,
    }));
  },
);
```

- Vendors provide historical market data for all OHLC data prefixed with `VENDOR_NAME`. However, this does not guarantee that all OHLC data prefixed with `VENDOR_NAME` exists, so vendors need to determine whether the Series ID exists themselves. Generally, vendors are indeed responsible for verifying the existence of Series IDs within their jurisdiction.
- When a Series ID does not exist, an exception is thrown, and the client will receive a 404 error.
- When there is no data within the given time range, an empty array is returned.
- When the API returns data outside the given time range, Yuan will automatically filter out the out-of-range data. Providers do not need to handle this themselves.
- The given time range is a left-closed, right-open interval, i.e., `[from, to)`, with timestamps in milliseconds.
