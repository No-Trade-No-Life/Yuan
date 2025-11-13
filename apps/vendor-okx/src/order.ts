import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, from, map, merge, mergeMap, repeat, retry, shareReplay, Subject, tap } from 'rxjs';
import { getTradingAccountId } from './account';
import { getDefaultCredential, getTradeOrdersHistory, getTradeOrdersPending } from './api/private-api';

export const order$ = new Subject<IOrder>();

order$
  .pipe(
    //
    // mergeMap((x) => x),
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      tableName: '"order"',
      writeInterval: 1000,
      columns: [
        'order_id',
        'account_id',
        'product_id',
        'position_id',
        'order_type',
        'order_direction',
        'volume',
        'submit_at',
        'updated_at',
        'filled_at',
        'price',
        'traded_volume',
        'traded_price',
        'order_status',
        'comment',
        'profit_correction',
        'real_profit',
        'inferred_base_currency_price',
      ],
      conflictKeys: ['account_id', 'order_id'],
    }),
  )
  .subscribe();

const makeOrder = (
  x: {
    ordType: string;
    side: string;
    posSide: string;
    instType: string;
    instId: string;
    cTime: string;
    uTime: string;
    fillTime: string;
    sz: string;
    accFillSz: string;
    px: string;
    avgPx: string;
    state: string;
    clOrdId: string;
    ordId: string;
  },
  account_id: string,
): IOrder => {
  const order_type = x.ordType === 'market' ? 'MARKET' : x.ordType === 'limit' ? 'LIMIT' : 'UNKNOWN';
  const order_direction =
    x.side === 'buy'
      ? x.posSide === 'long'
        ? 'OPEN_LONG'
        : 'CLOSE_SHORT'
      : x.posSide === 'short'
      ? 'OPEN_SHORT'
      : 'CLOSE_LONG';
  const order_status = ['live', 'partially_filled'].includes(x.state)
    ? 'ACCEPTED'
    : x.state === 'filled'
    ? 'TRADED'
    : 'CANCELLED';
  return {
    order_id: x.clOrdId !== '' ? x.clOrdId : x.ordId,
    account_id,
    product_id: encodePath(x.instType, x.instId),
    submit_at: +x.cTime,
    filled_at: +x.fillTime,
    created_at: formatTime(+x.cTime),
    updated_at: formatTime(+x.uTime),
    order_type,
    order_direction,
    volume: +x.sz,
    traded_volume: +x.accFillSz,
    price: +x.px,
    traded_price: +x.avgPx,
    order_status,
  };
};

(async () => {
  const TRADING_ACCOUNT_ID = await getTradingAccountId();

  const swapHistoryOrders = defer(() =>
    getTradeOrdersHistory(getDefaultCredential(), { instType: 'SWAP' }),
  ).pipe(repeat({ delay: 1000 }), retry({ delay: 1000 }), shareReplay(1));

  const swapPendingOrders = defer(() =>
    getTradeOrdersPending(getDefaultCredential(), { instType: 'SWAP' }),
  ).pipe(repeat({ delay: 1000 }), retry({ delay: 1000 }), shareReplay(1));

  const ordersFromHistoryOrder$ = swapHistoryOrders.pipe(
    //
    mergeMap((x) =>
      from(x.data || []).pipe(
        //
        map((x) => makeOrder(x, TRADING_ACCOUNT_ID)),
      ),
    ),
  );

  const ordersFromPendingOrder$ = swapPendingOrders.pipe(
    //
    mergeMap((x) =>
      from(x.data || []).pipe(
        //
        map((x) => makeOrder(x, TRADING_ACCOUNT_ID)),
      ),
    ),
  );

  merge(ordersFromHistoryOrder$, ordersFromPendingOrder$)
    .pipe(
      //
      tap((x) => {
        order$.next(x);
      }),
    )
    .subscribe();
})();
