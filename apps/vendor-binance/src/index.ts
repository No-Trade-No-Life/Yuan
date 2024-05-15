import { IDataRecord, IProduct, UUID, decodePath, encodePath, formatTime } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  concatWith,
  defer,
  firstValueFrom,
  from,
  interval,
  lastValueFrom,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { ApiClient } from './api';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `binance/${UUID()}`,
  name: 'Binance API',
});

const client = new ApiClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        public_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
      },
});

const futureExchangeInfo$ = defer(() => client.getFutureExchangeInfo()).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 60_000 }),
  shareReplay(1),
);
interface IFundingRate {
  series_id: string;
  datasource_id: string;
  product_id: string;
  funding_at: number;
  funding_rate: number;
}
const wrapFundingRateRecord = (v: IFundingRate): IDataRecord<IFundingRate> => ({
  id: encodePath(v.datasource_id, v.product_id, v.funding_at),
  type: 'funding_rate',
  created_at: v.funding_at,
  updated_at: v.funding_at,
  frozen_at: v.funding_at,
  tags: {
    series_id: encodePath(v.datasource_id, v.product_id),
    datasource_id: v.datasource_id,
    product_id: v.product_id,
  },
  origin: {
    series_id: encodePath(v.datasource_id, v.product_id),
    product_id: v.product_id,
    datasource_id: v.datasource_id,
    funding_rate: v.funding_rate,
    funding_at: v.funding_at,
  },
});

const futureProducts$ = futureExchangeInfo$.pipe(
  mergeMap((x) =>
    from(x.symbols).pipe(
      //
      map((symbol): IProduct => {
        return {
          datasource_id: 'binance/future',
          product_id: symbol.symbol,
          base_currency: symbol.baseAsset,
          quote_currency: symbol.quoteAsset,
          price_step: +`1e-${symbol.pricePrecision}`,
          value_scale: 1,
          volume_step: +`1e-${symbol.quantityPrecision}`,
        };
      }),
      toArray(),
    ),
  ),
  shareReplay(1),
);

futureProducts$.subscribe((products) => {
  terminal.updateProducts(products).subscribe();
});

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

defer(async () => {
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
            series_id: { type: 'string', pattern: '^binance/' },
          },
        },
      },
    },
    (msg, output$) => {
      const sub = interval(5000).subscribe(() => {
        output$.next({});
      });
      return defer(async () => {
        if (msg.req.tags?.series_id === undefined) {
          return { res: { code: 400, message: 'series_id is required' } };
        }
        const [start, end] = msg.req.time_range || [0, Date.now()];
        const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
        const funding_rate_history: IFundingRate[] = [];
        let current_end = end;
        while (true) {
          const res = await client.getFutureFundingRate({
            symbol: product_id,
            endTime: current_end,
            limit: 1000,
          });
          res.forEach((v) => {
            funding_rate_history.push({
              datasource_id,
              product_id,
              series_id: msg.req.tags!.series_id,
              funding_at: v.fundingTime,
              funding_rate: +v.fundingRate,
            });
          });
          if (res.length < 1000) {
            break;
          }
          current_end = +res[0].fundingTime;
          if (current_end <= start) {
            break;
          }
          await firstValueFrom(timer(1000));
        }
        funding_rate_history.sort((a, b) => +a.funding_at - +b.funding_at);
        // there will be at most 300 records, so we don't need to chunk it by bufferCount
        await lastValueFrom(
          from(funding_rate_history).pipe(
            map(wrapFundingRateRecord),
            toArray(),
            mergeMap((v) => terminal.updateDataRecords(v).pipe(concatWith(of(void 0)))),
          ),
        );
        return { res: { code: 0, message: 'OK' } };
      }).pipe(
        //
        tap({
          finalize: () => {
            console.info(
              formatTime(Date.now()),
              `CopyDataRecords`,
              `series_id=${msg.req.tags?.series_id} finalized`,
            );
            sub.unsubscribe();
          },
        }),
      );
    },
  );
}).subscribe();
