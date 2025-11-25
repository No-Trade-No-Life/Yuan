import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { requestPublic } from '../api/client';

const terminal = Terminal.fromNodeEnv();

const DURATION_TO_BINANCE_INTERVAL: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',
  PT1H: '1h',
  PT2H: '2h',
  PT4H: '4h',
  PT6H: '6h',
  PT8H: '8h',
  PT12H: '12h',
  P1D: '1d',
  P3D: '3d',
  P1W: '1w',
  P1M: '1M',
};

createSeriesProvider<IOHLC>(terminal, {
  tableName: 'ohlc',
  series_id_prefix_parts: ['BINANCE'],
  reversed: true,
  serviceOptions: { concurrent: 10 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const interval = DURATION_TO_BINANCE_INTERVAL[duration];
    if (!interval) {
      throw new Error(`Unsupported duration: ${duration}`);
    }
    const offset = convertDurationToOffset(duration);
    const [, instType, symbol] = decodePath(product_id);

    let current_end = ended_at || Date.now();
    const start = started_at || 0;

    const baseUrl =
      instType === 'usdt-future'
        ? 'https://fapi.binance.com/fapi/v1/klines'
        : 'https://api.binance.com/api/v3/klines';

    type IBinanceKline = [
      number, // Open time
      string, // Open
      string, // High
      string, // Low
      string, // Close
      string, // Volume
      number, // Close time
      string, // Quote asset volume
      number, // Number of trades
      string, // Taker buy base asset volume
      string, // Taker buy quote asset volume
      string, // Ignore
    ];

    while (true) {
      const res = await requestPublic<IBinanceKline[]>('GET', baseUrl, {
        symbol,
        interval,
        endTime: current_end,
        limit: 1000,
      });

      if (res.length === 0) break;

      const periods: IOHLC[] = res.map((k) => ({
        datasource_id,
        product_id,
        duration,
        created_at: formatTime(k[0]),
        closed_at: formatTime(k[0] + offset),
        open: `${k[1]}`,
        high: `${k[2]}`,
        low: `${k[3]}`,
        close: `${k[4]}`,
        volume: `${k[5]}`,
        open_interest: '0',
        series_id,
      }));

      yield periods;

      const oldest = periods[0];
      current_end = new Date(oldest.created_at).getTime() - 1;

      if (current_end < start) break;

      await firstValueFrom(timer(200));
    }
  },
});
