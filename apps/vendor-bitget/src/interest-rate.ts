import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';

createSeriesProvider<IInterestRate>(Terminal.fromNodeEnv(), {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['BITGET'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at }) {
    const [datasource_id, product_id] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);
    let current_page = 0;
    while (true) {
      // 向前翻页，时间降序
      const res = await client.getHistoricalFundingRate({
        symbol: instId,
        productType: instType,
        pageSize: '100',
        pageNo: '' + current_page,
      });
      if (res.msg !== 'success') {
        throw `API failed: ${res.code} ${res.msg}`;
      }
      if (res.data.length === 0) break;
      yield res.data.map(
        (v): IInterestRate => ({
          series_id,
          datasource_id,
          product_id,
          created_at: formatTime(+v.fundingTime),
          long_rate: `${-v.fundingRate}`,
          short_rate: `${v.fundingRate}`,
          settlement_price: '',
        }),
      );
      if (+res.data[res.data.length - 1].fundingTime <= started_at) break;
      current_page++;
      await firstValueFrom(timer(1000));
    }
  },
});
