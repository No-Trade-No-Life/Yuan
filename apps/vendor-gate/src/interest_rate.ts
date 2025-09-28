import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['GATE-FUTURE'],
  reversed: false,
  queryFn: async function ({ series_id }) {
    const [datasource_id, product_id] = decodePath(series_id);
    // 接口行为备注：无法翻页
    const funding_rate_history = await client.getFutureFundingRate('usdt', {
      contract: product_id,
      limit: 1000,
    });

    return funding_rate_history.map(
      (v): IInterestRate => ({
        series_id,
        product_id,
        datasource_id,
        created_at: formatTime(v.t * 1000),
        long_rate: `${-v.r}`,
        short_rate: `${v.r}`,
        settlement_price: '',
      }),
    );
  },
});
