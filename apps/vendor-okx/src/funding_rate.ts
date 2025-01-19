import { decodePath } from '@yuants/data-model';
import { provideDataSeries } from '@yuants/data-series';
import { firstValueFrom, timer } from 'rxjs';
import { mapProductIdToUsdtSwapProduct$ } from './legacy_index';
import { client } from './api';
import { terminal } from './terminal';

provideDataSeries(terminal, {
  type: 'funding_rate',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const start = started_at || 0;
    const end = ended_at || Date.now();
    const [datasource_id, product_id] = decodePath(series_id);
    const mapProductIdToUsdtSwapProduct = await firstValueFrom(mapProductIdToUsdtSwapProduct$);
    const theProduct = mapProductIdToUsdtSwapProduct.get(product_id);
    if (!theProduct) {
      throw `product_id ${product_id} not found`;
    }
    const { base_currency, quote_currency } = theProduct;
    const [instType, instId] = decodePath(product_id);
    if (!base_currency || !quote_currency) {
      throw `the product has no base_currency or quote_currency fields`;
    }
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
      const data = res.data.map((v) => ({
        series_id: series_id,
        product_id,
        datasource_id,
        base_currency,
        quote_currency,
        funding_rate: +v.fundingRate,
        funding_at: +v.fundingTime,
      }));
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
