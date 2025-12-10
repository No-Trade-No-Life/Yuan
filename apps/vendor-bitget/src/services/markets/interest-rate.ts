import { createCache } from '@yuants/cache';
import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { getDefaultCredential } from '../../api/client';
import { getSpotCrossInterestRate } from '../../api/private-api';
import { IUtaHistoricalFundingRate, getHistoryFundingRate, getInstruments } from '../../api/public-api';

const spotSymbolCache = createCache(
  async () => {
    const res = await getInstruments({ category: 'SPOT' });
    if (res.msg !== 'success') {
      throw new Error(`Bitget getInstruments failed: ${res.code} ${res.msg}`);
    }
    return res.data.reduce((acc: Record<string, { baseCoin: string; quoteCoin: string }>, v) => {
      acc[v.symbol] = { baseCoin: v.baseCoin, quoteCoin: v.quoteCoin };
      return acc;
    }, {});
  },
  { expire: 86400_000 },
);

createSeriesProvider<IInterestRate>(Terminal.fromNodeEnv(), {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['BITGET'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at }) {
    const [, instType, instId] = decodePath(series_id);
    let current_page = 1;
    if (instType === 'USDT-FUTURES') {
      while (true) {
        // 向前翻页，时间降序
        const res = await getHistoryFundingRate({
          category: 'USDT-FUTURES',
          symbol: instId,
          limit: '100',
          cursor: '' + current_page,
        });
        if (res.msg !== 'success') {
          throw new Error(`API failed: ${res.code} ${res.msg}`);
        }
        const list = res.data?.resultList ?? [];
        if (list.length === 0) break;
        yield list.map(
          (v: IUtaHistoricalFundingRate): IInterestRate => ({
            series_id,
            datasource_id: 'BITGET',
            product_id: series_id,
            created_at: formatTime(+v.fundingRateTimestamp),
            long_rate: `${-Number(v.fundingRate)}`,
            short_rate: `${Number(v.fundingRate)}`,
            settlement_price: '',
          }),
        );
        if (+list[list.length - 1].fundingRateTimestamp <= started_at) break;
        current_page++;
        await firstValueFrom(timer(1000));
      }
    } else if (instType === 'SPOT') {
      // Spot Lending Rate (Margin Interest Rate)
      // instId is the symbol, e.g. BTCUSDT.
      const map = await spotSymbolCache.query('ALL');
      const info = map?.[instId];
      if (!info) {
        console.warn(`Could not resolve base/quote for ${instId}`);
        return;
      }
      const { baseCoin: base, quoteCoin: quote } = info;
      const credential = getDefaultCredential();

      const resBase = await getSpotCrossInterestRate(credential, { coin: base });
      const resQuote = await getSpotCrossInterestRate(credential, { coin: quote });

      if (resBase.msg !== 'success') {
        throw new Error(`API failed for Base ${base}: ${resBase.code} ${resBase.msg}`);
      }
      if (resQuote.msg !== 'success') {
        throw new Error(`API failed for Quote ${quote}: ${resQuote.code} ${resQuote.msg}`);
      }

      // Bitget returns daily interest rate. Convert to hourly.
      // NOTE: long_rate = cost to borrow Quote (to buy Base)
      //       short_rate = cost to borrow Base (to sell Base)
      // Rates are usually positive costs, so we negate them for the interface (negative = cost).

      const baseRate = Number(resBase.data[0]?.dailyInterestRate ?? 0) / 24;
      const quoteRate = Number(resQuote.data[0]?.dailyInterestRate ?? 0) / 24;

      yield [
        {
          series_id,
          datasource_id: 'BITGET',
          product_id: series_id,
          created_at: formatTime(Date.now()),
          long_rate: `${-quoteRate}`,
          short_rate: `${-baseRate}`,
          settlement_price: '',
        },
      ];
    }
  },
});
