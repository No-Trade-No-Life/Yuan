import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getFutureFundingRate } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['GATE-FUTURE'],
  reversed: false,
  queryFn: async ({ series_id }) => {
    const [datasource_id, product_id] = decodePath(series_id);
    const fundingRateHistory = await getFutureFundingRate('usdt', { contract: product_id, limit: 1000 });
    const records = Array.isArray(fundingRateHistory) ? fundingRateHistory : [];
    return records.map(
      (item): IInterestRate => ({
        series_id,
        product_id,
        datasource_id,
        created_at: formatTime((item.t ?? 0) * 1000),
        long_rate: `${-(Number(item.r ?? 0))}`,
        short_rate: `${Number(item.r ?? 0)}`,
        settlement_price: '',
      }),
    );
  },
});
