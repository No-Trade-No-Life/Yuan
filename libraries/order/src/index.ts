import { IPosition, useAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { defer, filter, firstValueFrom, map, repeat, retry, shareReplay, tap } from 'rxjs';

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
            `!!!!!!!!!!!QueryOrderSuccess ${order.account_id} ${order.order_id} ${order.order_status}`,
          );
        },
      }),
    ),
  );

/**
 * Limit order controller
 *
 * 给定一个产品和目标持仓量，自动创建和调整限价订单以满足目标持仓量。
 * 处理如下逻辑：
 * 1. 检查当前持仓是否满足目标持仓量。
 * 2. 如果满足，则不创建新订单，并退出。
 * 3. 如果不满足，则创建新订单或调整现有订单。
 * 4. 如果订单价格偏离过大，则调整订单价格。
 * 5. 如果没有持仓或订单变更，则不进行任何操作。
 *
 * @public
 */
export async function* limitOrderController(
  terminal: Terminal,
  products: IProduct[],
  target: {
    account_id: string;
    datasource_id: string;
    product_id: string;
    direction: 'LONG' | 'SHORT';
    volume: number;
  },
) {
  const { account_id } = target;
  const accountInfo$ = useAccountInfo(terminal, account_id);

  const quotes$ = defer(() =>
    requestSQL<IQuote[]>(
      terminal,
      `select * from quote where datasource_id = ${escapeSQL(
        target.datasource_id,
      )} and product_id = ${escapeSQL(target.product_id)} order by updated_at desc limit 1`,
    ),
  ).pipe(repeat({ delay: 1000 }), retry({ delay: 1000 }), shareReplay(1));

  const theProduct = products.find((x) => x.product_id === target.product_id);
  if (!theProduct) throw new Error(`No Found ProductID ${target.product_id}`);

  // 生成 Order ID
  let theOrder = undefined;

  // 提取订单生成逻辑
  const createOrder = (
    order_id: string | undefined,
    thePosition: IPosition | undefined,
    quote: IQuote,
  ): IOrder => {
    const price = target.direction === 'LONG' ? +quote.bid_price : +quote.ask_price;
    return {
      order_id,
      account_id,
      product_id: target.product_id,
      position_id: thePosition ? thePosition.position_id : `${target.product_id}-${target.direction}`,
      order_type: 'LIMIT',
      order_direction: target.direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
      volume: target.volume - (thePosition?.volume || 0),
      price,
    };
  };

  console.info(
    formatTime(Date.now()),
    'Starting limit order controller for',
    target.product_id,
    'Direction:',
    target.direction,
    'Volume:',
    target.volume,
  );

  try {
    while (true) {
      const quotes = await firstValueFrom(quotes$);
      const accountInfo = await firstValueFrom(accountInfo$);
      if (quotes.length === 0) {
        throw new Error(`No quotes found for ${target.datasource_id} and ${target.product_id}`);
      }
      const quote = quotes[0];

      const thePosition = accountInfo.positions.find(
        (p) => p.product_id === target.product_id && p.direction === target.direction,
      );

      if (thePosition && thePosition.volume >= target.volume) {
        // 如果已有持仓且持仓量足够，则不需要创建新的委托
        console.info(formatTime(Date.now()), 'Sufficient position found, no new order needed');
        return;
      }

      if (theOrder == null && (thePosition?.volume || 0) < target.volume) {
        const order = createOrder(undefined, thePosition, quote);
        console.info(
          formatTime(Date.now()),
          `No existing order, creating new order`,
          thePosition?.volume,
          target.volume,
          order,
        );
        const res = await terminal.requestForResponse('SubmitOrder', order);
        if (res.code !== 0 || !res.data?.order_id) {
          console.error(formatTime(Date.now()), 'Failed to submit order', res);
          continue;
        }

        const the_order_id = res.data.order_id;
        // 新建委托之后必定导致 Order 变更
        theOrder = await queryOrder(terminal, account_id, the_order_id);

        yield void 0;
        continue;
      }

      if (theOrder != null && (thePosition?.volume || 0) + theOrder.volume < target.volume) {
        const order = createOrder(theOrder.order_id, thePosition, quote);
        console.info(
          formatTime(Date.now()),
          'Existing order volume less than target, creating new order',
          thePosition?.volume,
          target.volume,
          order,
        );
        // 改单或撤单后新建委托
        try {
          await terminal.requestForResponse('ModifyOrder', order);
          theOrder = await queryOrder(terminal, account_id, order.order_id!);
        } catch (e) {
          await terminal.requestForResponse('CancelOrder', {
            account_id: order.account_id,
            order_id: theOrder.order_id!,
            product_id: order.product_id,
          });
          await queryOrder(terminal, account_id, order.order_id!, 'CANCELLED');
          const res = await terminal.requestForResponse('SubmitOrder', order);
          if (res.code !== 0 || !res.data?.order_id) {
            console.error(formatTime(Date.now()), 'Failed to submit order', res);
            continue;
          }
          const the_order_id = res.data.order_id;
          // 新建委托之后必定导致 Order 变更
          theOrder = await queryOrder(terminal, account_id, the_order_id);
        }
        yield void 0;
        continue;
      }

      if (
        theOrder != null &&
        (((theOrder.order_direction === 'CLOSE_SHORT' || theOrder.order_direction === 'OPEN_LONG') &&
          theOrder.price! < +quote.bid_price! - theProduct.price_step! * 3) ||
          ((theOrder.order_direction === 'CLOSE_LONG' || theOrder.order_direction === 'OPEN_SHORT') &&
            theOrder.price! > +quote.ask_price! + theProduct.price_step! * 3))
      ) {
        const order = createOrder(theOrder.order_id, thePosition, quote);
        console.info(
          formatTime(Date.now()),
          'Order price deviated significantly, modifying order',
          thePosition?.volume,
          target.volume,
          order,
        );
        try {
          await terminal.requestForResponse('ModifyOrder', order);
          theOrder = await queryOrder(terminal, account_id, order.order_id!);
        } catch (e) {
          await terminal.requestForResponse('CancelOrder', {
            account_id: order.account_id,
            order_id: theOrder.order_id!,
            product_id: order.product_id,
          });
          await queryOrder(terminal, account_id, order.order_id!, 'CANCELLED');
          const res = await terminal.requestForResponse('SubmitOrder', order);
          if (res.code !== 0 || !res.data?.order_id) {
            console.error(formatTime(Date.now()), 'Failed to submit order', res);
            continue;
          }
          const the_order_id = res.data.order_id;
          // 新建委托之后必定导致 Order 变更
          theOrder = await queryOrder(terminal, account_id, the_order_id);
        }
        yield void 0;
      }
    }
  } finally {
    // 清理逻辑
    if (theOrder != null) {
      await terminal
        .requestForResponse('CancelOrder', {
          account_id,
          order_id: theOrder.order_id!,
          product_id: target.product_id,
        })
        .catch((err) => console.error('Cleanup error:', err));
    }
  }
}
