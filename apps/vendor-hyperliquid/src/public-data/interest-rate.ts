import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider, ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { defer, map, mergeAll, repeat, retry, shareReplay, tap } from 'rxjs';
import { getHistoricalFundingRates, getPerpetualsMetaData } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const perpetualProducts$ = defer(async () => {
  const meta = await getPerpetualsMetaData();
  return meta.universe.map((product) => ({
    product_id: encodePath('PERPETUAL', `${product.name}-USD`),
    datasource_id: 'HYPERLIQUID',
    no_interest_rate: false,
  }));
}).pipe(
  tap({ error: (err) => console.error(formatTime(Date.now()), 'PerpetualProductFetchFailed', err) }),
  retry({ delay: 10_000 }),
  repeat({ delay: 3600_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

createSQLWriter<ISeriesCollectingTask>(terminal, {
  data$: perpetualProducts$.pipe(
    map((products) => products.filter((product) => product.no_interest_rate === false)),
    mergeAll(),
    map(
      (product): ISeriesCollectingTask => ({
        series_id: encodePath(product.datasource_id, product.product_id),
        table_name: 'interest_rate',
        cron_pattern: '0 * * * *',
        cron_timezone: 'UTC',
        disabled: false,
        replay_count: 0,
      }),
    ),
  ),
  tableName: 'series_collecting_task',
  writeInterval: 1000,
  conflictKeys: ['series_id', 'table_name'],
});

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['HYPERLIQUID'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const start = started_at || 0;
    const end = ended_at || Date.now();
    const [datasource_id, product_id] = decodePath(series_id);
    const [, instId] = decodePath(product_id);
    const coin = instId.split('-')[0];
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
          product_id,
          datasource_id,
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
