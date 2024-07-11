import { IDataRecord, IOrder } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { defer, filter, map, toArray } from 'rxjs';
import { IQueryHistoryOrdersRequest } from '../services/pull';
import { Terminal } from '../terminal';
import { queryDataRecords } from './DataRecord';

/**
 * Map order to data record
 * Consider the order as an instantaneous product
 * Can be safely cached
 *
 * @public
 */
export const wrapOrder = (order: IOrder): IDataRecord<IOrder> => ({
  id: `${order.account_id}/${order.order_id}`,
  type: `order`,
  created_at: order.submit_at!,
  updated_at: Date.now(),
  frozen_at: order.filled_at!,
  tags: {
    order_id: order.order_id || '',
    account_id: order.account_id,
    product_id: order.product_id,
    order_type: order.order_type || '',
    order_direction: order.order_direction || '',
  },
  origin: order,
});

/**
 * Submit Order
 *
 * @public
 */
export const submitOrder = (terminal: Terminal, order: IOrder) =>
  observableToAsyncIterable(
    defer(() => terminal.requestService('SubmitOrder', order)).pipe(
      map((msg) => msg.res),
      filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
    ),
  );

/**
 * Modify Order
 *
 * @public
 */
export const modifyOrder = (terminal: Terminal, order: IOrder) =>
  observableToAsyncIterable(
    defer(() => terminal.requestService('ModifyOrder', order)).pipe(
      map((msg) => msg.res),
      filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
    ),
  );

/**
 * Cancel Order
 *
 * @public
 */
export const cancelOrder = (terminal: Terminal, order: IOrder) =>
  observableToAsyncIterable(
    defer(() => terminal.requestService('CancelOrder', order)).pipe(
      map((msg) => msg.res),
      filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
    ),
  );

/**
 * @public
 */
export const queryHistoryOrders = (terminal: Terminal, req: IQueryHistoryOrdersRequest) =>
  observableToAsyncIterable(
    defer(() =>
      queryDataRecords<IOrder>(terminal, {
        type: 'order',
        time_range: [(req.start_time_in_us ?? 0) / 1000, Date.now()],
        tags: { account_id: req.account_id },
      }),
    ).pipe(
      //
      map((dataRecord) => dataRecord.origin),
      toArray(),
    ),
  );
