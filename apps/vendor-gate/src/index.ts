import {
  IAccountInfo,
  IAccountMoney,
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
  combineLatestWith,
  concatWith,
  defer,
  first,
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

  const mapProductIdToUsdtFutureProduct$ = usdtFutureProducts$.pipe(
    map((x) => new Map(x.map((x) => [x.product_id, x]))),
    shareReplay(1),
  );

  const accountFuturePosition$ = defer(() => client.getFuturePositions('usdt')).pipe(
    //
    mergeMap((res) =>
      from(res).pipe(
        combineLatestWith(mapProductIdToUsdtFutureProduct$.pipe(first())),
        map(([position, mapProductIdToUsdtFutureProduct]): IPosition => {
          const product_id = position.contract;
          const theProduct = mapProductIdToUsdtFutureProduct.get(product_id);
          const volume = Math.abs(position.size);
          const closable_price = +position.mark_price;
          const valuation = volume * closable_price * (theProduct?.value_scale ?? 1);
          return {
            position_id: `${position.contract}-${position.leverage}-${position.mode}`,
            product_id,
            direction:
              position.mode === 'dual_long'
                ? 'LONG'
                : position.mode === 'dual_short'
                ? 'SHORT'
                : position.size > 0
                ? 'LONG'
                : 'SHORT',
            volume: volume,
            free_volume: Math.abs(position.size),
            position_price: +position.entry_price,
            closable_price,
            floating_profit: +position.unrealised_pnl,
            valuation,
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

      const money: IAccountMoney = {
        currency: 'USDT',
        balance,
        profit,
        free,
        used,
        equity,
      };
      return {
        updated_at: Date.now(),
        account_id: futureUsdtAccountId,
        money: money,
        currencies: [money],
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
    base_currency: string;
    quote_currency: string;
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
      base_currency: v.base_currency,
      quote_currency: v.quote_currency,
    },
    origin: {
      series_id: encodePath(v.datasource_id, v.product_id),
      datasource_id: v.datasource_id,
      product_id: v.product_id,
      base_currency: v.base_currency,
      quote_currency: v.quote_currency,
      funding_rate: v.funding_rate,
      funding_at: v.funding_at,
    },
  });

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
        const mapProductIdToUsdtFutureProduct = await firstValueFrom(mapProductIdToUsdtFutureProduct$);
        const theProduct = mapProductIdToUsdtFutureProduct.get(product_id);
        if (!theProduct) {
          return { res: { code: 404, message: 'product not found' } };
        }
        const { base_currency, quote_currency } = theProduct;
        if (!base_currency || !quote_currency) {
          return { res: { code: 400, message: 'base_currency and quote_currency is required' } };
        }
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
              (v): IFundingRate => ({
                series_id: msg.req.tags!.series_id,
                product_id,
                datasource_id,
                base_currency,
                quote_currency,
                funding_rate: +v.r,
                funding_at: v.t * 1000,
              }),
            ),
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
})();
