# Providing Historical Order Data

An [order](../basics/what-is-order) can be summarized as a query for a specific account within a specific time range, and it is also a problem of sequential data collection. Similar to historical market data, suppliers need to provide historical order data.

```ts
import { Terminal, provideSeriesData } from '@yuants/protocol';

const terminal = Terminal.fromNodeEnv();

provideDataSeries(
  terminal,
  {
    // Type of the data series
    type: 'order',
    // Regular expression for the data series, matching Series IDs will be passed to the callback function
    pattern: `^${ACCOUNT_ID}/`,
  },
  async (_, [from, to]) => {
    // No need to parse any information from the Series ID
    // Fetch historical order data from an external system (to be implemented by the user)
    const res = await Api.getHistoryOrders(from, to);
    // Convert to Yuan's order data format
    return res.map((x) => ({
      account_id: ACCOUNT_ID,
      // ... other fields
    }));
  },
);
```

- The provider supplies historical order data for all orders with the prefix `ACCOUNT_ID`.
- When there is no data within the given time range, an empty array is returned.
- If the API returns data outside the given time range, Yuan will automatically filter out the out-of-range data. The provider does not need to handle this.
- The given time range is a left-closed, right-open interval, i.e., `[from, to)`, with the timestamp unit being milliseconds.
