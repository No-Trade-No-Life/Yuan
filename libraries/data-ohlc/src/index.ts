import { addDataRecordSchema, addDataRecordWrapper, encodePath } from '@yuants/data-model';

declare module '@yuants/data-model/lib/DataRecord' {
  interface IDataRecordTypes {
    ohlc: {
      /**
       * Data source ID
       * 数据源 ID
       */
      datasource_id: string;
      /**
       * Product ID
       * 品种 ID
       */
      product_id: string;
      /**
       * duration, in RFC3339 Duration format
       *
       * @see https://www.ietf.org/rfc/rfc3339.txt
       *
       * @example
       * - `PT1M`: 1 minute
       * - `PT5M`: 5 minutes
       * - `PT15M`: 15 minutes
       * - `PT30M`: 30 minutes
       * - `PT1H`: 1 hour
       * - `PT2H`: 2 hours
       * - `PT4H`: 4 hours
       * - `P1D`: 1 day
       * - `P1W`: 1 week
       * - `P1M`: 1 month
       * - `P1Y`: 1 year
       */
      duration: string;

      /**
       * OHLC Opened Timestamp (in microseconds, inclusive)
       */
      opened_at: number;
      /**
       * OHLC Closed Timestamp (in microseconds, exclusive)
       */
      closed_at: number;

      /**
       * Open Price
       * 开盘价
       */
      open: number;
      /**
       * High Price
       * 最高价
       */
      high: number;
      /**
       * Low Price
       * 最低价
       */
      low: number;
      /**
       * Close Price
       * 收盘价
       */
      close: number;
      /**
       * Volume
       * 成交量
       *
       * - `undefined` means unknown (not available)
       */
      volume?: number;

      /**
       * Open interest
       * 持仓量
       *
       * - `undefined` means unknown (not available)
       */
      open_interest?: number;
    };
  }
}

addDataRecordWrapper('ohlc', (x) => {
  const series_id = encodePath(x.datasource_id, x.product_id, x.duration);
  return {
    id: encodePath(series_id, x.opened_at),
    type: 'ohlc',
    created_at: x.opened_at,
    updated_at: Date.now(),
    frozen_at: x.closed_at,
    tags: {
      series_id,
      datasource_id: x.datasource_id,
      product_id: x.product_id,
      duration: x.duration,
    },
    origin: x,
  };
});

addDataRecordSchema('ohlc', {
  type: 'object',
  required: [
    'datasource_id',
    'product_id',
    'duration',
    'opened_at',
    'closed_at',
    'open',
    'high',
    'low',
    'close',
  ],
  properties: {
    datasource_id: {
      type: 'string',
      title: 'Data Source ID',
    },
    product_id: {
      type: 'string',
      title: 'Product ID',
    },
    duration: {
      type: 'string',
      title: 'Duration',
    },
    opened_at: {
      type: 'number',
      title: 'Opened Timestamp',
    },
    closed_at: {
      type: 'number',
      title: 'Closed Timestamp',
    },
    open: {
      type: 'number',
      title: 'Open Price',
    },
    high: {
      type: 'number',
      title: 'High Price',
    },
    low: {
      type: 'number',
      title: 'Low Price',
    },
    close: {
      type: 'number',
      title: 'Close Price',
    },
    volume: {
      type: 'number',
      title: 'Volume',
    },
    open_interest: {
      type: 'number',
      title: 'Open Interest',
    },
  },
});
