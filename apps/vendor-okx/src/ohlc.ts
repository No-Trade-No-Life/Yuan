import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';

// 时间粒度，默认值1m
// 如 [1m/3m/5m/15m/30m/1H/2H/4H]
// 香港时间开盘价k线：[6H/12H/1D/1W/1M]
// UTC时间开盘价k线：[6Hutc/12Hutc/1Dutc/1Wutc/1Mutc]

const DURATION_TO_OKX_BAR_TYPE: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',

  PT1H: '1H',
  PT2H: '2H',
  PT4H: '4H',
  PT6H: '6H',
  PT12H: '12H',

  P1D: '1D',
  P1W: '1W',
  P1M: '1M',
};

createSeriesProvider<IOHLC>(Terminal.fromNodeEnv(), {
  tableName: 'ohlc',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, ended_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const offset = convertDurationToOffset(duration);
    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    if (!offset) {
      throw 'duration is invalid';
    }
    const [instType, instId] = decodePath(product_id);
    if (!instId) {
      throw `invalid product_id: ${product_id}`;
    }

    const bar = DURATION_TO_OKX_BAR_TYPE[duration];
    if (!bar) {
      throw `unsupported duration: ${duration}`;
    }

    let currentStartTime = ended_at;

    while (true) {
      // 向前翻页，时间降序，不含 after 时间点
      const res = await client.getHistoryCandles({
        instId,
        bar,
        after: `${currentStartTime}`,
        limit: '100',
      });
      if (res.code !== '0') {
        throw `API failed: ${res.code} ${res.msg}`;
      }
      if (res.data.length === 0) break;
      currentStartTime = +res.data[res.data.length - 1][0];
      const data = res.data.map(
        (x): IOHLC => ({
          series_id,
          datasource_id,
          product_id,
          duration,
          created_at: formatTime(+x[0]),
          closed_at: formatTime(+x[0] + offset),
          open: x[1],
          high: x[2],
          low: x[3],
          close: x[4],
          volume: x[5],
          open_interest: '0',
        }),
      );
      yield data;
      await firstValueFrom(timer(1000));
    }
  },
});
