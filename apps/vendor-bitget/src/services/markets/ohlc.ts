import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { getMixCandles, getSpotCandles } from '../../api/public-api';

// Bitget granularity mapping
// Bitget supports: 1m, 5m, 15m, 30m, 1H, 4H, 12H, 1D, 1W
// Bitget granularity mapping
// Bitget supports: 1m, 5m, 15m, 30m, 1H, 4H, 12H, 1D, 1W
const mapDurationToGranularity = (duration: string) => {
  if (duration === 'PT1M') return '1m';
  if (duration === 'PT5M') return '5m';
  if (duration === 'PT15M') return '15m';
  if (duration === 'PT30M') return '30m';
  if (duration === 'PT1H') return '1H';
  if (duration === 'PT4H') return '4H';
  if (duration === 'PT12H') return '12H';
  if (duration === 'P1D') return '1D';
  if (duration === 'P1W') return '1W';
  throw new Error(`Unsupported duration: ${duration}`);
};

createSeriesProvider<IOHLC>(Terminal.fromNodeEnv(), {
  tableName: 'ohlc',
  series_id_prefix_parts: ['BITGET'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);
    const granularity = mapDurationToGranularity(duration);
    const offset = convertDurationToOffset(duration);

    let currentEndTime = ended_at ? ended_at : Date.now();

    while (true) {
      let candles: [string, string, string, string, string, string, string][] = [];

      if (instType === 'USDT-FUTURES') {
        const res = await getMixCandles({
          symbol: instId,
          productType: instType,
          granularity,
          endTime: '' + currentEndTime,
          limit: '100',
        });
        if (res.msg !== 'success') throw new Error(`Bitget get mix candles failed: ${res.code} ${res.msg}`);
        candles = res.data;
      } else if (instType === 'SPOT') {
        const res = await getSpotCandles({
          symbol: instId,
          granularity,
          endTime: '' + currentEndTime,
          limit: '100',
        });
        if (res.msg !== 'success') throw new Error(`Bitget get spot candles failed: ${res.code} ${res.msg}`);
        candles = res.data;
      } else {
        throw new Error(`Unsupported product type: ${instType}`);
      }

      if (candles.length === 0) break;

      yield candles.map((v) => ({
        series_id,
        datasource_id,
        product_id,
        duration,
        created_at: formatTime(+v[0]),
        closed_at: formatTime(+v[0] + offset),
        open: v[1],
        high: v[2],
        low: v[3],
        close: v[4],
        volume: v[5],
        open_interest: '0',
      }));

      const oldestTimestamp = +candles[candles.length - 1][0];
      if (oldestTimestamp <= started_at) break;
      currentEndTime = oldestTimestamp - 1;
      await firstValueFrom(timer(200)); // Rate limit protection
    }
  },
});
