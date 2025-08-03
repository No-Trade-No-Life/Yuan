import { IInterestRate } from '@yuants/data-interest-rate';
import { IProduct } from '@yuants/data-product';
import { createSeriesProvider, ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, map, mergeAll, ObservableInput, timer } from 'rxjs';
import { client } from './api';
import { perpetualProduct$ } from './product';

createSQLWriter<ISeriesCollectingTask>(Terminal.fromNodeEnv(), {
  data$: perpetualProduct$.pipe(
    mergeAll(),
    map(
      (x: IProduct): ISeriesCollectingTask => ({
        series_id: encodePath(x.datasource_id, x.product_id),
        table_name: 'interest_rate',
        cron_pattern: '0 * * * *', // 每小时执行一次
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

createSeriesProvider<IInterestRate>(Terminal.fromNodeEnv(), {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['HYPERLIQUID'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({
    series_id,
    started_at,
    ended_at,
  }: {
    series_id: string;
    started_at?: number;
    ended_at?: number;
  }): ObservableInput<IInterestRate[]> {
    const start = started_at || 0;
    const end = ended_at || Date.now();
    const [datasource_id, product_id] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);

    // 从 instId 中提取币种名称，例如 "BTC-USDC" -> "BTC"
    const coin = instId.split('-')[0];

    let current_start = start;

    while (current_start <= end) {
      try {
        const res = await client.getHistoricalFundingRates({
          coin: coin,
          startTime: current_start,
          endTime: end,
        });

        console.info(formatTime(Date.now()), 'getHistoricalFundingRates', coin, `${current_start}-${end}`);

        if (!res || res.length === 0) {
          break;
        }

        // 过滤并转换数据
        const filteredData = res.filter((v) => v.time >= current_start && v.time <= end);

        if (filteredData.length === 0) {
          break;
        }

        const data = filteredData.map(
          (v): IInterestRate => ({
            series_id: series_id,
            product_id,
            datasource_id,
            created_at: formatTime(v.time),
            long_rate: `${-parseFloat(v.fundingRate)}`,
            short_rate: `${v.fundingRate}`,
            settlement_price: '',
          }),
        );

        yield data;

        if (res.length < 500) {
          break;
        }

        const latestTime = filteredData[filteredData.length - 1].time;
        current_start = latestTime + 1;
      } catch (error) {
        console.error(formatTime(Date.now()), 'getHistoricalFundingRates failed', coin, error);
        throw error;
      }

      // API 限制控制
      await firstValueFrom(timer(1000));
    }
  },
});
