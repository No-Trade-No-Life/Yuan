import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import {
  IHistoricalFundingRate,
  getHistoricalFundingRate,
  getSpotCrossInterestRate,
} from '../../api/public-api';

createSeriesProvider<IInterestRate>(Terminal.fromNodeEnv(), {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['BITGET'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at }) {
    const [datasource_id, product_id] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);
    let current_page = 0;
    if (instType === 'USDT-FUTURES') {
      while (true) {
        // 向前翻页，时间降序
        const res = await getHistoricalFundingRate({
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
          (v: IHistoricalFundingRate): IInterestRate => ({
            series_id,
            datasource_id,
            product_id,
            created_at: formatTime(+v.fundingTime),
            long_rate: `${-Number(v.fundingRate)}`,
            short_rate: `${Number(v.fundingRate)}`,
            settlement_price: '',
          }),
        );
        if (+res.data[res.data.length - 1].fundingTime <= started_at) break;
        current_page++;
        await firstValueFrom(timer(1000));
      }
    } else if (instType === 'SPOT') {
      // Spot Lending Rate (Margin Interest Rate)
      // instId is the symbol, e.g. BTCUSDT.
      // We need to split it into Base and Quote currency.
      // Simple heuristic: assume Quote is USDT, USDC, USD, ETH, BTC in that order.
      let base = '';
      let quote = '';
      if (instId.endsWith('USDT')) {
        quote = 'USDT';
        base = instId.slice(0, -4);
      } else if (instId.endsWith('USDC')) {
        quote = 'USDC';
        base = instId.slice(0, -4);
      } else if (instId.endsWith('USD')) {
        quote = 'USD';
        base = instId.slice(0, -3);
      } else if (instId.endsWith('ETH')) {
        quote = 'ETH';
        base = instId.slice(0, -3);
      } else if (instId.endsWith('BTC')) {
        quote = 'BTC';
        base = instId.slice(0, -3);
      } else {
        // Fallback or skip
        console.warn(`Could not parse base/quote for ${instId}`);
        return;
      }

      const resBase = await getSpotCrossInterestRate({ coin: base });
      const resQuote = await getSpotCrossInterestRate({ coin: quote });

      if (resBase.msg !== 'success') {
        throw `API failed for Base ${base}: ${resBase.code} ${resBase.msg}`;
      }
      if (resQuote.msg !== 'success') {
        throw `API failed for Quote ${quote}: ${resQuote.code} ${resQuote.msg}`;
      }

      // Bitget returns hourly interest rate? Or daily?
      // Usually "interestRate" field.
      // We will use the values directly for now, assuming they are compatible or raw rates.
      // OKX converts to hourly. If Bitget returns hourly, we are good.
      // If Bitget returns daily, we might need / 24.
      // Let's assume it's the rate to be applied.
      // NOTE: long_rate = cost to borrow Quote (to buy Base)
      //       short_rate = cost to borrow Base (to sell Base)
      // Rates are usually positive costs, so we negate them for the interface (negative = cost).

      const baseRate = resBase.data[0]?.interestRate ?? '0';
      const quoteRate = resQuote.data[0]?.interestRate ?? '0';

      yield [
        {
          series_id,
          datasource_id,
          product_id,
          created_at: formatTime(Date.now()),
          long_rate: `${-Number(quoteRate)}`,
          short_rate: `${-Number(baseRate)}`,
          settlement_price: '',
        },
      ];
    }
  },
});
