import { IPosition, useAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import {
  defer,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  Observable,
  repeat,
  retry,
  shareReplay,
  Subject,
  tap,
  timer,
} from 'rxjs';

const queryOrder = (terminal: Terminal, account_id: string, order_id: string, status?: string) =>
  firstValueFrom(
    defer(() =>
      requestSQL<IOrder[]>(
        terminal,
        `select * from "order" where account_id = ${escapeSQL(account_id)} and order_id = ${escapeSQL(
          order_id,
        )} ${status ? ` and status = ${escapeSQL(status)}` : ''}`,
      ),
    ).pipe(
      //
      repeat({ delay: 1000 }),
      retry({ delay: 1000 }),
      filter((x) => x.length > 0),
      map((x) => x[0]),
      tap({
        next: (order) => {
          console.info(
            formatTime(Date.now()),
            `QueryOrderSuccess ${order.account_id} ${order.order_id} ${order.order_status}`,
          );
        },
      }),
    ),
  );

interface IControllerContext {
  account_id: string | undefined;
  theOrder: IOrder | undefined;
  thePosition: IPosition | undefined;
  theProduct: IProduct | undefined;
  quote: IQuote | undefined;
}

// 提取订单生成逻辑
const createOrder = (
  account_id: string,
  order_id: string | undefined,
  thePosition: IPosition | undefined,
  quote: IQuote,
  target: {
    account_id: string;
    product_id: string;
    direction: string;
    volume: number;
  },
): IOrder => {
  const volume = target.volume - (thePosition?.volume || 0);
  const direction =
    volume > 0
      ? target.direction === 'LONG'
        ? 'OPEN_LONG'
        : 'OPEN_SHORT'
      : target.direction === 'LONG'
      ? 'CLOSE_LONG'
      : 'CLOSE_SHORT';
  const price =
    volume > 0
      ? target.direction === 'LONG'
        ? +quote.bid_price
        : +quote.ask_price
      : target.direction === 'LONG'
      ? +quote.ask_price
      : +quote.bid_price;

  return {
    order_id,
    account_id,
    product_id: target.product_id,
    position_id: thePosition ? thePosition.position_id : `${target.product_id}-${target.direction}`,
    order_type: 'LIMIT',
    order_direction: direction,
    volume: Math.abs(volume),
    price,
  };
};

/**
 * Limit Order Controller
 *
 * @public
 */
export const limitOrderController = (
  terminal: Terminal,
  theProduct: IProduct,
  target: {
    account_id: string;
    product_id: string;
    direction: string;
    volume: number;
  },
): Observable<void> => {
  return new Observable<void>((subscriber) => {
    const controllerCtx: IControllerContext = {
      account_id: undefined,
      theOrder: undefined,
      thePosition: undefined,
      theProduct: undefined,
      quote: undefined,
    };

    const accountInfo$ = useAccountInfo(terminal, target.account_id);
    const quotes$ = defer(() =>
      requestSQL<IQuote[]>(
        terminal,
        `select * from quote where datasource_id = ${escapeSQL(
          theProduct.datasource_id,
        )} and product_id = ${escapeSQL(target.product_id)} order by updated_at desc limit 1`,
      ),
    ).pipe(
      repeat({ delay: 1000 }),
      retry({ delay: 1000 }),
      shareReplay({
        bufferSize: 1,
        refCount: true,
      }),
    );

    const startState$ = new Subject<void>();
    const completeState$ = new Subject<void>();
    const distributeState$ = new Subject<void>();
    const toSubmitState$ = new Subject<void>();
    const toModifyState$ = new Subject<void>();

    startState$.subscribe(() => {
      console.debug(formatTime(Date.now()), `StartState`, JSON.stringify(target));
    });

    startState$.subscribe(() => {
      distributeState$.next();
    });

    distributeState$.subscribe(() => {
      console.debug(formatTime(Date.now()), `DistributeState`, JSON.stringify(target));
    });

    distributeState$.subscribe(() => {
      subscriber.next();
    });

    distributeState$
      .pipe(
        //
        mergeMap(() =>
          defer(async () => {
            const accountInfo = await firstValueFrom(accountInfo$);
            const quotes = await firstValueFrom(quotes$);
            if (quotes.length === 0) {
              throw new Error(`No quotes found for ${theProduct.datasource_id} and ${target.product_id}`);
            }
            const quote = quotes[0];
            const thePosition = accountInfo.positions.find(
              (p) => p.product_id === target.product_id && p.direction === target.direction,
            );
            controllerCtx.account_id = accountInfo.account_id;
            controllerCtx.theProduct = theProduct;
            controllerCtx.quote = quote;
            controllerCtx.thePosition = thePosition;

            // 1. 满足持仓量则退出
            if (thePosition && thePosition.volume === target.volume) {
              completeState$.next();
              return;
            }

            // 2. 不满足持仓量且无订单则创建新订单
            if (
              (controllerCtx.theOrder == null || controllerCtx.theOrder.order_status !== 'ACCEPTED') &&
              // 开仓
              ((controllerCtx.thePosition?.volume || 0) < target.volume ||
                // 平仓
                (controllerCtx.thePosition?.volume || 0) > target.volume)
            ) {
              toSubmitState$.next();
              return;
            }

            // 3. 不满足持仓量且有订单修改订单
            if (
              controllerCtx.theOrder != null &&
              // 开仓
              ((controllerCtx.thePosition?.volume || 0) + controllerCtx.theOrder.volume < target.volume ||
                // 平仓
                (controllerCtx.thePosition?.volume || 0) + controllerCtx.theOrder.volume > target.volume)
            ) {
              toModifyState$.next();
              return;
            }

            // 4. 不满足持仓量且有订单且订单价格偏离过大则调整订单
            if (
              controllerCtx.theOrder != null &&
              (((controllerCtx.theOrder.order_direction === 'CLOSE_SHORT' ||
                controllerCtx.theOrder.order_direction === 'OPEN_LONG') &&
                controllerCtx.theOrder.price! < +quote.bid_price! - theProduct.price_step! * 3) ||
                ((controllerCtx.theOrder.order_direction === 'CLOSE_LONG' ||
                  controllerCtx.theOrder.order_direction === 'OPEN_SHORT') &&
                  controllerCtx.theOrder.price! > +quote.ask_price! + theProduct.price_step! * 3))
            ) {
              toModifyState$.next();
              return;
            }

            await firstValueFrom(timer(100));
            distributeState$.next();
          }),
        ),
      )
      .subscribe(() => {});

    toSubmitState$.subscribe(() => {
      console.debug(formatTime(Date.now()), `ToSubmitState`, JSON.stringify(target));
    });

    toSubmitState$
      .pipe(
        //
        mergeMap(() =>
          defer(async () => {
            const order = createOrder(
              controllerCtx.account_id!,
              undefined,
              controllerCtx.thePosition!,
              controllerCtx.quote!,
              target,
            );
            const res = await terminal.requestForResponse('SubmitOrder', order);

            if (res.code !== 0 || !res.data?.order_id) {
              console.error(formatTime(Date.now()), 'Failed to submit order', res);
              return;
            }

            const the_order_id = res.data.order_id;
            controllerCtx.theOrder = await queryOrder(terminal, controllerCtx.account_id!, the_order_id);

            distributeState$.next();
          }),
        ),
      )
      .subscribe();

    toModifyState$.subscribe(() => {
      console.debug(formatTime(Date.now()), `ToModifyState`, JSON.stringify(target));
    });

    toModifyState$
      .pipe(
        //
        mergeMap(() =>
          defer(async () => {
            const order = createOrder(
              controllerCtx.account_id!,
              controllerCtx.theOrder!.order_id,
              controllerCtx.thePosition!,
              controllerCtx.quote!,
              target,
            );
            try {
              await terminal.requestForResponse('ModifyOrder', order);
              controllerCtx.theOrder = await queryOrder(terminal, controllerCtx.account_id!, order.order_id!);
            } catch (e) {
              await terminal.requestForResponse('CancelOrder', {
                account_id: order.account_id,
                order_id: controllerCtx.theOrder!.order_id!,
                product_id: order.product_id,
              });
              await queryOrder(terminal, controllerCtx.account_id!, order.order_id!, 'CANCELLED');
              const res = await terminal.requestForResponse('SubmitOrder', order);
              if (res.code !== 0 || !res.data?.order_id) {
                console.error(formatTime(Date.now()), 'Failed to submit order', res);
                return;
              }
              const the_order_id = res.data.order_id;
              controllerCtx.theOrder = await queryOrder(terminal, controllerCtx.account_id!, the_order_id);
            }
            distributeState$.next();
          }),
        ),
      )
      .subscribe();

    completeState$.subscribe(() => {
      console.debug(formatTime(Date.now()), `CompleteState`, JSON.stringify(target));
    });

    completeState$.subscribe(() => {
      subscriber.complete();
    });

    startState$.next();

    return () => {
      if (controllerCtx.theOrder != null) {
        terminal
          .requestForResponse('CancelOrder', {
            account_id: controllerCtx.account_id!,
            order_id: controllerCtx.theOrder.order_id!,
            product_id: target.product_id,
          })
          .catch((err) => console.error('CleanupError:', err));
      }
      startState$.complete();
      completeState$.complete();
      distributeState$.complete();
      toSubmitState$.complete();
      toModifyState$.complete();
    };
  });
};
