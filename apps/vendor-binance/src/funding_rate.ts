import { decodePath } from '@yuants/data-model';
import { provideDataSeries } from '@yuants/data-series';
import { firstValueFrom, timer } from 'rxjs';
import { client } from './api';
import { mapProductIdToFutureProduct$ } from './legacy_index';
import { terminal } from './terminal';

provideDataSeries(terminal, {
  type: 'funding_rate',
  series_id_prefix_parts: ['binance'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const [datasource_id, product_id] = decodePath(series_id);
    const mapProductIdToFutureProduct = await firstValueFrom(mapProductIdToFutureProduct$);
    const theProduct = mapProductIdToFutureProduct.get(product_id);
    if (!theProduct) throw `product ${product_id} not found`;
    const { base_currency, quote_currency } = theProduct;
    if (!base_currency || !quote_currency) throw `base_currency or quote_currency is required`;
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
      yield res.map((v) => ({
        datasource_id,
        product_id,
        base_currency,
        quote_currency,
        series_id,
        funding_at: v.fundingTime,
        funding_rate: +v.fundingRate,
      }));
      if (res.length < 1000) {
        break;
      }
      current_start = +res[res.length - 1].fundingTime;
      await firstValueFrom(timer(1000));
    }
  },
});
