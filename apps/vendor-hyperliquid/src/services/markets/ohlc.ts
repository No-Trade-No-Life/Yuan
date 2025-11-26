import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { getCandleSnapshot } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();

const DURATION_TO_HYPERLIQUID_INTERVAL: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',
  PT1H: '1h',
  PT2H: '2h',
  PT4H: '4h',
  PT8H: '8h',
  PT12H: '12h',
  P1D: '1d',
  P3D: '3d',
  P1W: '1w',
  P1M: '1M',
};

const DURATION_TO_PERIOD_IN_SEC: Record<string, number> = {
  PT1M: 60,
  PT3M: 180,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,
  PT1H: 3600,
  PT2H: 7200,
  PT4H: 14400,
  PT8H: 28800,
  PT12H: 43200,
  P1D: 86400,
  P3D: 259200,
  P1W: 604800,
  P1M: 2592000,
};

createSeriesProvider<IOHLC>(terminal, {
  tableName: 'ohlc',
  series_id_prefix_parts: ['HYPERLIQUID'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, ended_at }) {
    const [datasource_id, instType, symbol, duration] = decodePath(series_id);
    const product_id = encodePath(datasource_id, instType, symbol);
    const period_in_sec = DURATION_TO_PERIOD_IN_SEC[duration];
    if (!datasource_id || !instType || !symbol || !duration || !period_in_sec) {
      throw new Error(`Invalid series_id: ${series_id}`);
    }
    if (datasource_id !== 'HYPERLIQUID') {
      throw new Error(`Invalid datasource for series_id: ${series_id}`);
    }
    const coin = symbol?.split('-')?.[0];
    if (!coin) {
      throw new Error(`Invalid product symbol: ${symbol}`);
    }
    const interval = DURATION_TO_HYPERLIQUID_INTERVAL[duration];
    if (!interval) {
      throw new Error(`Unsupported duration: ${duration}`);
    }
    const startTime = 0;
    const res = await getCandleSnapshot({
      req: {
        coin,
        interval,
        startTime,
        endTime: ended_at,
      },
    });
    if (!res || !res.length) {
      return;
    }
    const data = res
      .filter((x) => x.t < ended_at)
      .map(
        (x): IOHLC => ({
          series_id,
          datasource_id,
          product_id,
          duration,
          created_at: formatTime(x.t),
          closed_at: formatTime(x.t + period_in_sec * 1000),
          open: x.o,
          high: x.h,
          low: x.l,
          close: x.c,
          volume: x.v,
          open_interest: '0',
        }),
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (data.length > 0) {
      yield data;
    }
  },
});
