import { IAccountMoney, IPosition } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';

import { defer, from, map, mergeMap, toArray } from 'rxjs';

import { GateClient } from './api';

(async () => {
  const client = new GateClient({
    auth: {
      access_key: process.env.ACCESS_KEY!,
      secret_key: process.env.SECRET_KEY!,
    },
  });

  const gate_account = await client.getUnifiedAccounts({ currency: 'USDT' });
  const uid = gate_account.user_id;
  const account_id = `gate/${uid}`;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `gate-client-${account_id}`,
  });

  const accountFuturePosition$ = defer(() => client.getFuturePositions()).pipe(
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
            volume: position.size,
            free_volume: position.size,
            position_price: +position.entry_price,
            closable_price: +position.mark_price,
            floating_profit: +position.unrealised_pnl,
          };
        }),
        toArray(),
      ),
    ),
  );

  const accountFutureOpenOrders$ = defer(() => client.getFuturesOrders({ status: 'open' })).pipe(
    //
    mergeMap((res) =>
      from(res).pipe(
        map((order) => {
          return {
            order_id: order.id,
            account_id,
            product_id: order.contract,
            order_type: 'LIMIT',
            order_direction: order.size > 0 ? 'LONG' : 'SHORT',
            volume: Math.abs(order.size),
            price: order.price !== undefined ? +order.price : undefined,
          };
        }),
      ),
    ),
  );

  const accountMoney$ = defer(() => client.getUnifiedAccounts({ currency: 'USDT' })).pipe(
    //
    map((gate_account): IAccountMoney => {
      return {
        currency: 'USDT',
        equity: +gate_account.total,
      };
    }),
  );
})();
