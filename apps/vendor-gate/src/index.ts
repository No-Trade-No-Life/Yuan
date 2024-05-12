import { IAccountInfo, IOrder, IPosition } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { combineLatest, defer, from, map, mergeMap, repeat, retry, shareReplay, toArray } from 'rxjs';
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
  );

  const futureAccount$ = defer(() => client.getFuturesAccounts('usdt')).pipe(
    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
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
    { properties: { account_id: { const: futureUsdtAccountId } } },
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
    { properties: { account_id: { const: futureUsdtAccountId } } },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        await client.deleteFutureOrders('usdt', order.order_id!);
        return { res: { code: 0, message: 'OK' } };
      }),
  );
})();
