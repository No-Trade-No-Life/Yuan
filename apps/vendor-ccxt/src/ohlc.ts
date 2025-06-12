import { decodePath, encodePath, formatTime } from '@yuants/data-model';
import { convertDurationToMilliseconds, IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { firstValueFrom, timer } from 'rxjs';
import { ex, EXCHANGE_ID } from './api';
import { mapProductIdToSymbol } from './product';
import { terminal } from './terminal';

const mapMsToCCXTTimeframe = (period: number): string => {
  if (period % 2592_000_000 === 0) {
    return `${period / 2592_000_000}M`;
  }
  if (period % 604800_000 === 0) {
    return `${period / 604800_000}w`;
  }
  if (period % 86400_000 === 0) {
    return `${period / 86400_000}d`;
  }
  if (period % 3600_000 === 0) {
    return `${period / 3600_000}h`;
  }
  if (period % 60_000 === 0) {
    return `${period / 60_000}m`;
  }
  return `${period / 1000}s`;
};

createSeriesProvider<IOHLC>(terminal, {
  series_id_prefix_parts: [encodePath('CCXT', EXCHANGE_ID)],
  tableName: 'ohlc',
  reversed: false,
  queryFn: async function* ({ series_id, started_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const ms = convertDurationToMilliseconds(duration);
    const timeframe = mapMsToCCXTTimeframe(ms);

    const LIMIT = 100;
    const timeInterval = ms * LIMIT; // 100 Bars

    if (!product_id) throw new Error(`Product ID is required for OHLCV query: ${series_id}`);
    if (!timeframe) throw new Error(`Timeframe is required for OHLCV query: ${series_id}`);

    // ISSUE: OKX 的接口语义为两侧开区间，因此需要 -1 以包含 start_time_in_us
    let current_start_timestamp = started_at - 1;

    while (true) {
      const data = await ex.fetchOHLCV(
        mapProductIdToSymbol[product_id],
        timeframe,
        current_start_timestamp,
        LIMIT,
        {
          until: current_start_timestamp + timeInterval,
        },
      );

      const ret: IOHLC[] = data.map(
        ([t, o, h, l, c, vol]): IOHLC => ({
          series_id,
          datasource_id,
          product_id,
          duration,
          created_at: formatTime(t!),
          closed_at: formatTime(t! + ms),
          open: `${o!}`,
          high: `${h!}`,
          low: `${l!}`,
          close: `${c!}`,
          volume: `${vol!}`,
          open_interest: '',
        }),
      );

      yield ret;

      current_start_timestamp += timeInterval;

      await firstValueFrom(timer(1000)); // 等待 1 秒以避免过于频繁的请求
    }
  },
});
