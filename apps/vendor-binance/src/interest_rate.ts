import { IInterestRate } from '@yuants/data-interest-rate';
import { decodePath, formatTime } from '@yuants/utils';
import { createSeriesProvider } from '@yuants/data-series';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['BINANCE'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const [datasource_id, product_id] = decodePath(series_id);
    let current_start = started_at;
    const [instType, symbol] = decodePath(product_id);
    while (true) {
      // 向前翻页，时间降序
      const res = await client.getFutureFundingRate({
        symbol: symbol,
        startTime: current_start,
        endTime: ended_at,
        limit: 1000,
      });
      yield res.map(
        (v): IInterestRate => ({
          series_id,
          created_at: formatTime(v.fundingTime),
          datasource_id,
          product_id,
          long_rate: `${-v.fundingRate}`,
          short_rate: `${v.fundingRate}`,
          settlement_price: '',
        }),
      );
      if (res.length < 1000) {
        break;
      }
      current_start = +res[res.length - 1].fundingTime;
      await firstValueFrom(timer(1000));
    }
  },
});
