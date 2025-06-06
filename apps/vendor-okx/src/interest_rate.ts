import { IInterestRate } from '@yuants/data-interest-rate';
import { decodePath, encodePath, formatTime } from '@yuants/data-model';
import { createSeriesProvider, ISeriesCollectingTask } from '@yuants/data-series';
import { createSQLWriter } from '@yuants/sql';
import { firstValueFrom, map, mergeAll, timer } from 'rxjs';
import { client } from './api';
import { usdtSwapProducts$ } from './product';
import { terminal } from './terminal';

createSQLWriter<ISeriesCollectingTask>(terminal, {
  data$: usdtSwapProducts$.pipe(
    mergeAll(),
    map(
      (x): ISeriesCollectingTask => ({
        series_id: encodePath(x.datasource_id, x.product_id),
        table_name: 'interest_rate',
        cron_pattern: '0 * * * * *', // 每小时执行一次
        cron_timezone: 'UTC',
        disabled: false,
        replay_count: 0,
      }),
    ),
  ),
  tableName: 'series_collecting_task',
  writeInterval: 1000,
  conflictKeys: ['series_id', 'table_name'],
});

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const start = started_at || 0;
    const end = ended_at || Date.now();
    const [datasource_id, product_id] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);
    let current_end = end;
    while (true) {
      // 接口行为备注：向前翻页，时间降序，不含 after 当前时间点
      const res = await client.getFundingRateHistory({
        instId: instId,
        after: `${current_end}`,
      });
      if (res.code !== '0') {
        throw `getFundingRateHistory failed: ${res.code} ${res.msg}`;
      }
      // 如果没有数据了，就退出
      if (res.data.length === 0) {
        break;
      }
      console.info(formatTime(Date.now()), 'getFundingRateHistory', JSON.stringify(res.data));
      const data = res.data.map(
        (v): IInterestRate => ({
          series_id: series_id,
          product_id,
          datasource_id,
          created_at: formatTime(+v.fundingTime),
          long_rate: `${-v.fundingRate}`,
          short_rate: `${v.fundingRate}`,
          settlement_price: '',
        }),
      );
      yield data;
      current_end = +res.data[res.data.length - 1].fundingTime;
      if (current_end <= start) {
        break;
      }
      // for API rate limit
      await firstValueFrom(timer(1000));
    }
  },
});
