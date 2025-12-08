import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, timer } from 'rxjs';
import { getMarginInterestRateHistory } from '../api/private-api';
import { getFutureFundingRate } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['BINANCE'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    let current_start = started_at;
    const [, instType, symbol] = decodePath(series_id);
    if (instType === 'USDT-FUTURE') {
      while (true) {
        await firstValueFrom(timer(1000));
        // 向前翻页，时间降序
        const res = await getFutureFundingRate({
          symbol: symbol,
          startTime: current_start,
          endTime: ended_at,
          limit: 1000,
        });
        yield res.map(
          (v): IInterestRate => ({
            series_id,
            created_at: formatTime(v.fundingTime),
            datasource_id: 'BINANCE',
            product_id: series_id,
            long_rate: `${-v.fundingRate}`,
            short_rate: `${v.fundingRate}`,
            settlement_price: '',
          }),
        );
        if (res.length < 1000) {
          break;
        }
        current_start = +res[res.length - 1].fundingTime;
      }
      return;
    }
    if (instType === 'MARGIN') {
      while (true) {
        await firstValueFrom(timer(1000));
        const res = await getMarginInterestRateHistory({
          asset: symbol,
          startTime: current_start,
          endTime: ended_at,
          limit: 100,
        });
        yield res.map(
          (v): IInterestRate => ({
            series_id,
            created_at: formatTime(v.timestamp),
            datasource_id: 'BINANCE',
            product_id: series_id,
            long_rate: v.dailyInterestRate,
            short_rate: '0',
            settlement_price: '',
          }),
        );
        if (res.length < 100) {
          break;
        }
        current_start = +res[res.length - 1].timestamp;
      }
    }
    return;
  },
});
