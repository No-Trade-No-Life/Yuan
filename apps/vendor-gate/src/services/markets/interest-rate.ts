import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getFutureFundingRate } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['GATE-FUTURE'],
  reversed: false,
  queryFn: async ({ series_id }) => {
    const [, product_id] = decodePath(series_id);
    if (!product_id) {
      return [];
    }
    const funding_rate_history = await getFutureFundingRate('usdt', {
      contract: product_id,
      limit: 1000,
    });

    return funding_rate_history.map(
      (entry): IInterestRate => ({
        series_id,
        product_id,
        datasource_id: 'GATE-FUTURE',
        created_at: formatTime(entry.t * 1000),
        long_rate: `${-Number(entry.r)}`,
        short_rate: `${Number(entry.r)}`,
        settlement_price: '',
      }),
    );
  },
});
