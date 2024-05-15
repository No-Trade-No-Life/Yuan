import {
  IAccountInfo,
  IDataRecord,
  IOrder,
  IPosition,
  IProduct,
  decodePath,
  encodePath,
  formatTime,
} from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  combineLatest,
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
import { GateClient } from './api';

(async () => {
  const client = new GateClient({
    auth: {
      access_key: process.env.ACCESS_KEY!,
      secret_key: process.env.SECRET_KEY!,
    },
  });

  const gate_account = await client.getAccountDetail();
  const uid = gate_account.user_id;

  const futureUsdtAccountId = `gate/${uid}/future/usdt`;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `@yuants/vendor-gate/${uid}`,
  });

  const usdtFutureProducts$ = defer(() => client.getFuturesContracts('usdt', {})).pipe(
    mergeMap((contracts) =>
      from(contracts).pipe(
        map((contract): IProduct => {
          const [base, quote] = contract.name.split('_');
          return {
            datasource_id: 'gate/future',
            product_id: contract.name,
            base_currency: base,
            quote_currency: quote,
            value_scale: +contract.quanto_multiplier,
            price_step: +contract.order_price_round,
            volume_step: 1,
          };
        }),
        toArray(),
      ),
    ),

    repeat({ delay: 3600_000 }),
    retry({ delay: 60_000 }),
    shareReplay(1),
  );

  usdtFutureProducts$.subscribe((products) => {
    terminal.updateProducts(products).subscribe();
  });

  const accountFuturePosition$ = defer(() => client.getFuturePositions('usdt')).pipe(
    //
    mergeMap((res) =>
      from(res).pipe(
        map((position): IPosition => {
          return {
            position_id: `${position.contract}-${position.leverage}-${position.mode}`,
            product_id: position.contract,
            direction:
              position.mode === 'dual_long'
                ? 'LONG'
                : position.mode === 'dual_short'
                ? 'SHORT'
                : position.size > 0
                ? 'LONG'
                : 'SHORT',
            volume: Math.abs(position.size),
            free_volume: Math.abs(position.size),
            position_price: +position.entry_price,
            closable_price: +position.mark_price,
            floating_profit: +position.unrealised_pnl,
          };
        }),
        toArray(),
      ),
    ),
    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const accountFutureOpenOrders$ = defer(() => client.getFuturesOrders('usdt', { status: 'open' })).pipe(
    //
    mergeMap((res) =>
      from(res).pipe(
        map((order): IOrder => {
          return {
            order_id: order.id,
            account_id: futureUsdtAccountId,
            submit_at: order.create_time * 1000,
            product_id: order.contract,
            order_type: 'LIMIT',
            order_direction:
              order.size > 0
                ? order.is_close
                  ? 'CLOSE_SHORT'
                  : 'OPEN_LONG'
                : order.is_close
                ? 'CLOSE_LONG'
                : 'OPEN_SHORT',
            volume: Math.abs(order.size),
            price: order.price !== undefined ? +order.price : undefined,
          };
        }),
        toArray(),
      ),
    ),
    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const futureAccount$ = defer(() => client.getFuturesAccounts('usdt')).pipe(
    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const futureUsdtAccountInfo$ = combineLatest([
    accountFuturePosition$,
    accountFutureOpenOrders$,
    futureAccount$,
  ]).pipe(
    map(([positions, orders, account]): IAccountInfo => {
      const free = +account.available;
      const profit = +account.unrealised_pnl;
      const balance = +account.total;
      const equity = balance + profit;
      const used = equity - free;

      return {
        updated_at: Date.now(),
        timestamp_in_us: Date.now() * 1000,
        account_id: futureUsdtAccountId,
        money: {
          currency: 'USDT',
          balance,
          profit,
          free,
          used,
          equity,
        },
        positions,
        orders,
      };
    }),
    shareReplay(1),
  );

  terminal.provideAccountInfo(futureUsdtAccountInfo$);

  terminal.provideService(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: futureUsdtAccountId } },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        const res = await client.postFutureOrders('usdt', {
          contract: order.product_id,
          size:
            order.volume *
            (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 1 : -1),
          price: order.order_type === 'MARKET' ? '0' : `${order.price}`,
          tif: order.order_type === 'MARKET' ? 'ioc' : 'gtc',
          reduce_only: order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT',
        });
        if (res.label && res.detail) {
          return { res: { code: 400, message: `${res.label}: ${res.detail}` } };
        }
        return { res: { code: 0, message: 'OK' } };
      }),
  );

  terminal.provideService(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: futureUsdtAccountId } },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        await client.deleteFutureOrders('usdt', order.order_id!);
        return { res: { code: 0, message: 'OK' } };
      }),
  );

  interface IFundingRate {
    series_id: string;
    datasource_id: string;
    product_id: string;
    funding_at: number;
    funding_rate: number;
  }

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
            series_id: { type: 'string', pattern: '^gate/.+' },
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
        // best effort to get all funding rate history required
        const limit = Math.min(1000, Math.round((end - start) / 3600_000));
        const funding_rate_history = await client.getFutureFundingRate('usdt', {
          contract: product_id,
          limit,
        });
        funding_rate_history.sort((a, b) => a.t - b.t);
        // there will be at most 1000 records, so we don't need to chunk it by bufferCount
        await lastValueFrom(
          from(funding_rate_history).pipe(
            map(
              (v): IDataRecord<IFundingRate> => ({
                id: encodePath('gate', product_id, v.t * 1000),
                type: 'funding_rate',
                created_at: v.t * 1000,
                updated_at: v.t * 1000,
                frozen_at: v.t * 1000,
                tags: {
                  series_id: msg.req.tags!.series_id,
                  datasource_id,
                  product_id,
                },
                origin: {
                  series_id: msg.req.tags!.series_id,
                  product_id,
                  datasource_id,
                  funding_rate: +v.r,
                  funding_at: v.t * 1000,
                },
              }),
            ),
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
})();
