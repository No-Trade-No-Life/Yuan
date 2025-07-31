import { diffPosition, IAccountInfo, IOrder, IPosition, useAccountInfo } from '@yuants/data-account';
import { IProduct } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime, observableToAsyncIterable } from '@yuants/utils';

const queryQuote = (terminal: Terminal, datasource_id: string, product_id: string) =>
  requestSQL<IQuote[]>(
    terminal,
    `select * from quote where datasource_id = ${escapeSQL(datasource_id)} and product_id
    = ${escapeSQL(product_id)} order by updated_at desc limit 1`,
  );

const diffOrders = (oldOrders: IOrder[], newOrders: IOrder[]): [IOrder | undefined, IOrder | undefined][] => {
  const diffs: [IOrder | undefined, IOrder | undefined][] = [];
  for (const newOrder of newOrders) {
    const oldOrder = oldOrders.find((o) => o.order_id === newOrder.order_id);
    if (!oldOrder) {
      diffs.push([newOrder, undefined]);
      continue;
    }
    if (oldOrder.volume !== newOrder.volume || oldOrder.price !== newOrder.price) {
      diffs.push([oldOrder, newOrder]);
    }
  }
  for (const oldOrder of oldOrders) {
    if (!newOrders.find((o) => o.order_id === oldOrder.order_id)) {
      diffs.push([oldOrder, undefined]);
    }
  }
  return diffs;
};

/**
 * Limit order controller
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

  const theProduct = products.find((x) => x.product_id === target.product_id);
  if (!theProduct) throw new Error(`No Found ProductID ${target.product_id}`);

  // 生成 Order ID
  let order_id = undefined;

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
    let lastState:
      | {
          accountInfo: IAccountInfo;
          quote: IQuote;
        }
      | undefined;

    for await (const accountInfo of observableToAsyncIterable(accountInfo$)) {
      // 查询价格
      const quotes = await queryQuote(terminal, target.datasource_id!, target.product_id);
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

      // 确保使用最新的 accountInfo
      if (lastState) {
        if (accountInfo.updated_at! <= lastState.accountInfo.updated_at!) {
          console.info(formatTime(Date.now()), 'Skipping old account info update');
          continue;
        }
        const positionDiffs = diffPosition(lastState.accountInfo.positions, accountInfo.positions).filter(
          (v) => v.error_volume > 0,
        );
        const orderDiffs = diffOrders(lastState.accountInfo.orders, accountInfo.orders);

        const theOrder = accountInfo.orders.find(
          (o) =>
            o.product_id === target.product_id &&
            (target.direction === 'LONG'
              ? o.order_direction === 'OPEN_LONG' || o.order_direction === 'CLOSE_LONG'
              : o.order_direction === 'OPEN_SHORT' || o.order_direction === 'CLOSE_SHORT'),
        );
        order_id = theOrder?.order_id;
        const priceDiff =
          theOrder !== undefined
            ? Math.abs(
                theOrder.price! -
                  (theOrder.order_direction === 'OPEN_LONG' || theOrder.order_direction === 'CLOSE_SHORT'
                    ? +quote.bid_price!
                    : +quote.ask_price!),
              )
            : undefined;

        // 检查是否需要继续处理
        const hasPriceDeviation = priceDiff && priceDiff > theProduct.price_step! * 3;
        const hasNoChanges = positionDiffs.length === 0 && orderDiffs.length === 0;
        if (hasPriceDeviation) {
          // 价格偏差较大，需要继续处理订单调整
          console.info(
            formatTime(Date.now()),
            'Price deviation detected, continuing to process order adjustment',
          );
        } else if (hasNoChanges) {
          console.info(formatTime(Date.now()), 'No position or order changes detected');
          continue;
        }
      } else {
        console.info(formatTime(Date.now()), 'No last state available, cannot determine changes');
      }
      lastState = {
        accountInfo,
        quote,
      };

      const theOrder = accountInfo.orders.find(
        (o) =>
          o.product_id === target.product_id &&
          (target.direction === 'LONG'
            ? o.order_direction === 'OPEN_LONG' || o.order_direction === 'CLOSE_LONG'
            : o.order_direction === 'OPEN_SHORT' || o.order_direction === 'CLOSE_SHORT'),
      );

      // 如果没有持仓，或者持仓量小于当前委托量，则需要创建新的委托
      if (theOrder == null) {
        if ((thePosition?.volume || 0) < target.volume) {
          const order = createOrder(undefined, thePosition, quote);
          console.info(
            formatTime(Date.now()),
            `No existing order, creating new order`,
            thePosition?.volume,
            target.volume,
            order,
          );
          yield terminal.requestForResponse('SubmitOrder', order);
        }
      } else {
        if ((thePosition?.volume || 0) + theOrder.volume < target.volume) {
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
            yield terminal.requestForResponse('ModifyOrder', order);
          } catch (e) {
            await terminal.requestForResponse('CancelOrder', {
              account_id: order.account_id,
              order_id,
              product_id: order.product_id,
            });
            yield terminal.requestForResponse('SubmitOrder', order);
          }
        } else {
          if (
            ((theOrder.order_direction === 'CLOSE_SHORT' || theOrder.order_direction === 'OPEN_LONG') &&
              theOrder.price! < +quote.bid_price! - theProduct.price_step! * 3) ||
            ((theOrder.order_direction === 'CLOSE_LONG' || theOrder.order_direction === 'OPEN_SHORT') &&
              theOrder.price! > +quote.ask_price! + theProduct.price_step! * 3)
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
              yield terminal.requestForResponse('ModifyOrder', order);
            } catch (e) {
              await terminal.requestForResponse('CancelOrder', {
                account_id: order.account_id,
                order_id,
                product_id: order.product_id,
              });
              yield terminal.requestForResponse('SubmitOrder', order);
            }
          } else {
            console.info(formatTime(Date.now()), 'No action needed, existing order is sufficient');
          }
        }
      }
    }
  } finally {
    // 清理逻辑
    await terminal
      .requestForResponse('CancelOrder', {
        account_id,
        order_id,
        product_id: target.product_id,
      })
      .catch((err) => console.error('Cleanup error:', err));
  }
}
