import { decodePath, formatTime } from '@yuants/data-model';
import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

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

const DURATION_TO_PERIOD_IN_SEC: Record<string, number> = {
  PT1M: 60,
  PT3M: 180,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,

  PT1H: 3600,
  PT2H: 7200,
  PT4H: 14400,
  PT6H: 21600,
  PT12H: 43200,

  P1D: 86400,
  P1W: 604800,
  P1M: 2592000,
};

createSeriesProvider<IOHLC>(terminal, {
  tableName: 'ohlc',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, ended_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const period_in_sec = DURATION_TO_PERIOD_IN_SEC[duration];
    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    if (!period_in_sec) {
      throw 'period_in_sec is required';
    }
    const [instType, instId] = decodePath(product_id);
    if (!instId) {
      throw `invalid product_id: ${product_id}`;
    }

    const bar = DURATION_TO_OKX_BAR_TYPE[duration];
    if (!bar) {
      throw `unsupported duration: ${duration}`;
    }

    const mapResDataToIPeriod = (
      x: [ts: string, o: string, h: string, l: string, c: string, confirm: string],
    ): IOHLC => ({
      series_id,
      datasource_id,
      product_id,
      duration,
      created_at: formatTime(+x[0]),
      closed_at: formatTime(+x[0] + period_in_sec * 1000),
      open: x[1],
      high: x[2],
      low: x[3],
      close: x[4],
      // TODO: volume
      volume: '0',
      open_interest: '0',
    });

    let currentStartTime = ended_at;

    while (true) {
      // 向前翻页，时间降序，不含 after 时间点
      const res = await client.getHistoryMarkPriceCandles({
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
      const data = res.data.map(mapResDataToIPeriod);
      yield data;
      await firstValueFrom(timer(1000));
    }
  },
});
