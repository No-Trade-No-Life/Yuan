import { IInterestRate } from '@yuants/data-interest-rate';
import { IProduct } from '@yuants/data-product';
import { createSeriesProvider, ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, map, mergeAll, timer } from 'rxjs';
import { getFApiV1FundingRate } from '../../api/public-api';
import { productService } from './product';

const terminal = Terminal.fromNodeEnv();

createSQLWriter<ISeriesCollectingTask>(terminal, {
  data$: productService.products$.pipe(
    map((products: IProduct[]) => products.filter((product) => product.no_interest_rate === false)),
    mergeAll(),
    map(
      (product: IProduct): ISeriesCollectingTask => ({
        series_id: product.product_id,
        table_name: 'interest_rate',
        cron_pattern: '0 * * * *',
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
  series_id_prefix_parts: ['ASTER'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const start = started_at ?? 0;
    const end = ended_at ?? Date.now();
    const [, instType, instId] = decodePath(series_id);

    if (instType !== 'PERP') {
      return;
    }

    let currentStart = start;

    while (currentStart <= end) {
      const res = await getFApiV1FundingRate({
        symbol: instId,
        startTime: currentStart,
        endTime: end,
        limit: 1000,
      });

      if (!Array.isArray(res) || res.length === 0) {
        break;
      }

      const filtered = res.filter((item) => item.fundingTime >= currentStart && item.fundingTime <= end);

      if (filtered.length === 0) {
        const lastRecord = res[res.length - 1];
        const nextStart = lastRecord.fundingTime + 1;
        if (nextStart <= currentStart) {
          break;
        }
        currentStart = nextStart;
        await firstValueFrom(timer(1000));
        continue;
      }

      const data = filtered.map((item): IInterestRate => {
        const rate = Number(item.fundingRate);
        return {
          series_id,
          product_id: series_id,
          datasource_id: 'ASTER',
          created_at: formatTime(item.fundingTime),
          long_rate: `${-rate}`,
          short_rate: `${rate}`,
          settlement_price: '',
        };
      });

      yield data;

      const lastTime = filtered[filtered.length - 1].fundingTime;
      if (lastTime >= end) {
        break;
      }

      currentStart = lastTime + 1;

      if (res.length < 1000) {
        break;
      }

      await firstValueFrom(timer(1000));
    }
  },
});
