import {
  IDataRecordTypes,
  IProduct,
  UUID,
  decodePath,
  encodePath,
  formatTime,
  getDataRecordWrapper,
} from '@yuants/data-model';
import { Terminal, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { defer, delayWhen, firstValueFrom, from, interval, map, repeat, retry, shareReplay, tap } from 'rxjs';
import { CoinExClient } from './api';

const DATASOURCE_ID = 'CoinEx';

const client = new CoinExClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        access_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
      },
});

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const terminal = new Terminal(process.env.HOST_URL!, {
  name: 'CoinEx',
  terminal_id: process.env.TERMINAL_ID || `bitget/${UUID()}`,
});

const futuresProducts$ = defer(async () => {
  const res = await client.getFuturesMarket();
  if (res.code !== 0) {
    throw new Error(res.message);
  }

  const futures = res.data.map(
    (item): IProduct => ({
      datasource_id: DATASOURCE_ID,
      product_id: encodePath('SWAP', item.market),
      quote_currency: item.quote_ccy,
      base_currency: item.base_ccy,
      price_step: Number(item.quote_ccy_precision),
      // FIXME: volume_step, value_scale
      volume_step: 1,
      value_scale: 1,
    }),
  );
  return futures;
}).pipe(
  tap({
    error: (e) => {
      console.error(formatTime(Date.now()), 'FuturesProducts', e);
    },
  }),
  retry({ delay: 5000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

futuresProducts$
  .pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
  )
  .subscribe((products) => {
    console.info(formatTime(Date.now()), 'FUTUREProductsUpdated', products.length);
  });

const mapProductIdToFuturesProduct$ = futuresProducts$.pipe(
  //
  map((products) => new Map(products.map((v) => [v.product_id, v]))),
  shareReplay(1),
);

terminal.provideService(
  'CopyDataRecords',
  {
    required: ['type', 'tags'],
    properties: {
      type: { const: 'funding_rate' },
      tags: {
        type: 'object',
        required: ['series_id'],
        properties: {
          series_id: { type: 'string', pattern: '^coinex/' },
        },
      },
    },
  },
  (msg, output$) => {
    const sub = interval(5000).subscribe(() => {
      output$.next({});
    });
    return defer(async () => {
      console.info(formatTime(Date.now()), 'CopyDataRecords', msg);
      if (msg.req.tags?.series_id === undefined) {
        return { res: { code: 400, message: 'series_id is required' } };
      }
      const [start, end] = msg.req.time_range || [0, Date.now()];
      const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
      const mapProductsToFutureProducts = await firstValueFrom(mapProductIdToFuturesProduct$);
      const theProduct = mapProductsToFutureProducts.get(product_id);
      if (theProduct === undefined) {
        return { res: { code: 404, message: `product ${product_id} not found` } };
      }
      const { base_currency, quote_currency } = theProduct;
      if (!base_currency || !quote_currency) {
        return { res: { code: 400, message: `base_currency or quote_currency is required` } };
      }
      const [instType, instId] = decodePath(product_id);
      const funding_rate_history: IDataRecordTypes['funding_rate'][] = [];
      let current_page = 0;

      while (true) {
        const res = await client.getFuturesFundingRateHistory({
          market: instId,
          start_time: start,
          end_time: end,
          page: current_page,
          limit: 100,
        });
        if (res.code !== 0) {
          console.error(
            formatTime(Date.now()),
            'HistoricalFundingRate',
            `series_id: ${msg.req.tags.series_id}`,
            res,
          );
          return { res: { code: 500, message: res.message } };
        }
        if (res.data.length === 0) {
          break;
        }

        for (const v of res.data) {
          if (+v.funding_time <= end) {
            funding_rate_history.push({
              series_id: msg.req.tags.series_id,
              datasource_id,
              product_id,
              base_currency,
              quote_currency,
              funding_at: +v.funding_time,
              funding_rate: +v.actual_funding_rate,
            });
          }
        }
        if (!res.pagination.has_next || +res.data[res.data.length - 1].funding_time <= start) {
          break;
        }
        current_page++;
      }

      funding_rate_history.sort((a, b) => a.funding_at - b.funding_at);

      await firstValueFrom(
        from(writeDataRecords(terminal, funding_rate_history.map(getDataRecordWrapper('funding_rate')!))),
      );
      return { res: { code: 0, message: 'OK' } };
    }).pipe(
      tap({
        finalize: () => {
          sub.unsubscribe();
        },
      }),
    );
  },
);
