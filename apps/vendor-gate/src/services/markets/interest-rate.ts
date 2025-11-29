import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getFutureFundingRate } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['GATE'],
  reversed: false,
  queryFn: async ({ series_id }) => {
    const [, , contract] = decodePath(series_id);
    const funding_rate_history = await getFutureFundingRate('usdt', {
      contract: contract,
      limit: 1000,
    });

    return funding_rate_history.map(
      (entry): IInterestRate => ({
        series_id,
        product_id: series_id,
        datasource_id: 'GATE',
        created_at: formatTime(entry.t * 1000),
        long_rate: `${-Number(entry.r)}`,
        short_rate: `${Number(entry.r)}`,
        settlement_price: '',
      }),
    );
  },
});
