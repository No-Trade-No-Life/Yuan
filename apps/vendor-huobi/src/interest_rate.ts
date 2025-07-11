import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';

createSeriesProvider<IInterestRate>(Terminal.fromNodeEnv(), {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['HUOBI-SWAP'],
  reversed: true,
  serviceOptions: { concurrent: 10 },
  queryFn: async function* ({ series_id, started_at }) {
    const [datasource_id, product_id] = decodePath(series_id);

    let current_page = 0;
    let total_page = 1;
    while (true) {
      // 向前翻页，时间降序
      const res = await client.getSwapHistoricalFundingRate({
        contract_code: product_id,
        page_index: current_page,
      });
      if (res.status !== 'ok') {
        throw `API failed: ${res.status}`;
      }
      if (res.data.data.length === 0) break;
      yield res.data.data.map(
        (v): IInterestRate => ({
          series_id,
          datasource_id,
          product_id,
          created_at: formatTime(+v.funding_time),
          long_rate: `${-v.funding_rate}`,
          short_rate: `${v.funding_rate}`,
          settlement_price: '',
        }),
      );
      total_page = res.data.total_page;
      current_page++;
      if (current_page >= total_page) break;
      if (+res.data.data[res.data.data.length - 1].funding_time <= started_at) break;
      await firstValueFrom(timer(1000));
    }
  },
});
