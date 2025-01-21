import { decodePath, IPeriod } from '@yuants/data-model';
import { provideDataSeries } from '@yuants/data-series';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

provideDataSeries(terminal, {
  type: 'period',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, ended_at }) {
    const [datasource_id, product_id, _period_in_sec] = decodePath(series_id);
    const period_in_sec = +_period_in_sec;
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
    // 时间粒度，默认值1m
    // 如 [1m/3m/5m/15m/30m/1H/2H/4H]
    // 香港时间开盘价k线：[6H/12H/1D/1W/1M]
    // UTC时间开盘价k线：[6Hutc/12Hutc/1Dutc/1Wutc/1Mutc]
    const PERIOD_IN_SEC_TO_OKX_BAR_TYPE: Record<number, string> = {
      60: '1m',
      180: '3m',
      300: '5m',
      900: '15m',
      1800: '30m',
      3600: '1H',
      7200: '2H',
      14400: '4H',
      21600: '6H',
      43200: '12H',
      86400: '1D',
      604800: '1W',
      2592000: '1M',
    };

    const bar = PERIOD_IN_SEC_TO_OKX_BAR_TYPE[period_in_sec];
    if (!bar) {
      throw `unsupported period_in_sec: ${period_in_sec}`;
    }

    const PERIOD_IN_SEC_TO_DURATION: Record<number, string> = {
      60: 'PT1M',
      180: 'PT3M',
      300: 'PT5M',
      900: 'PT15M',
      1800: 'PT30M',
      3600: 'PT1H',
      7200: 'PT2H',
      14400: 'PT4H',
      21600: 'PT6H',
      43200: 'PT12H',
      86400: 'P1D',
      604800: 'P1W',
      2592000: 'P1M',
    };

    const mapResDataToIPeriod = (
      x: [ts: string, o: string, h: string, l: string, c: string, confirm: string],
    ): IPeriod => ({
      datasource_id,
      product_id,
      period_in_sec: +period_in_sec,
      duration: PERIOD_IN_SEC_TO_DURATION[period_in_sec],
      timestamp_in_us: +x[0] * 1000,
      start_at: +x[0],
      open: +x[1],
      high: +x[2],
      low: +x[3],
      close: +x[4],
      // TODO: volume
      volume: 0,
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
      const periods = res.data.map(mapResDataToIPeriod);
      yield periods;
      await firstValueFrom(timer(1000));
    }
  },
});
