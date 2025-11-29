import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['coinex'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const [, instType, instId] = decodePath(series_id);
    let current_page = 0;

    while (true) {
      const res = await client.getFuturesFundingRateHistory({
        market: instId,
        start_time: started_at,
        end_time: ended_at,
        page: current_page,
        limit: 100,
      });
      if (res.code !== 0) {
        throw `API failed: ${res.code} ${res.message}`;
      }
      if (res.data.length === 0) break;

      yield res.data.map(
        (v): IInterestRate => ({
          series_id,
          datasource_id: 'COINEX',
          product_id: series_id,
          created_at: formatTime(+v.funding_time),
          long_rate: `${-v.actual_funding_rate}`,
          short_rate: `${v.actual_funding_rate}`,
          settlement_price: '',
        }),
      );
      if (!res.pagination.has_next) break;
      if (+res.data[res.data.length - 1].funding_time <= started_at) break;
      current_page++;
      await firstValueFrom(timer(1000));
    }
  },
});
