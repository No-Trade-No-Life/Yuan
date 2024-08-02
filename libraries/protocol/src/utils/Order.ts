import { IOrder } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { defer, filter, map, toArray } from 'rxjs';
import { IQueryHistoryOrdersRequest } from '../services/pull';
import { Terminal } from '../terminal';
import { queryDataRecords } from './DataRecord';

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
