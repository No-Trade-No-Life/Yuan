import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getHistoricalFundingRates } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['HYPERLIQUID', 'PERPETUAL'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const start = started_at || 0;
    const end = ended_at || Date.now();
    const [, , instId] = decodePath(series_id);
    const coin = instId?.split('-')?.[0];
    if (!coin) {
      throw new Error(`Invalid product in series_id: ${series_id}`);
    }
    let current = start;
    while (current <= end) {
      const res = await getHistoricalFundingRates({ coin, startTime: current, endTime: end });
      if (!res || res.length === 0) {
        break;
      }
      const filtered = res.filter((v) => v.time >= current && v.time <= end);
      if (!filtered.length) {
        break;
      }
      yield filtered.map(
        (v): IInterestRate => ({
          series_id,
          product_id: series_id,
          datasource_id: 'HYPERLIQUID',
          created_at: formatTime(v.time),
          long_rate: `${-parseFloat(v.fundingRate)}`,
          short_rate: `${v.fundingRate}`,
          settlement_price: '',
        }),
      );
      if (res.length < 500) {
        break;
      }
      current = filtered[filtered.length - 1].time + 1;
    }
  },
});
