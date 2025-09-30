import { IconRefresh } from '@douyinfe/semi-icons';
import { Space } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IOrder } from '@yuants/data-order';
import { formatTime } from '@yuants/utils';
import { useEffect, useMemo, useRef } from 'react';
import { useObservable, useObservableState } from 'observable-hooks';
import {
  Subject,
  catchError,
  combineLatestWith,
  defer,
  firstValueFrom,
  merge,
  of,
  pipe,
  repeat,
  retry,
  switchMap,
  timer,
} from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { Button, DataView, Toast } from '../Interactive';
import { InlineProductId } from '../Products/InlineProductId';
import { terminal$ } from '../Terminals';

const helper = createColumnHelper<IOrder>();

const columns = [
  helper.accessor('order_id', { header: () => '委托单号' }),
  helper.accessor('account_id', {
    header: () => '账户',
    cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
  }),
  helper.accessor('product_id', {
    header: () => '品种',
    cell: (ctx) => {
      const order = ctx.row.original as IOrder & { datasource_id?: string };
      return order.datasource_id ? (
        <InlineProductId datasource_id={order.datasource_id} product_id={order.product_id} />
      ) : (
        ctx.getValue()
      );
    },
  }),
  helper.accessor('order_direction', { header: () => '方向' }),
  helper.accessor('order_type', { header: () => '类型' }),
  helper.accessor('volume', { header: () => '委托量' }),
  helper.accessor('price', { header: () => '委托价' }),
  helper.accessor('traded_volume', { header: () => '已成交量' }),
  helper.accessor('submit_at', {
    header: () => '提交时间',
    cell: (ctx) => (ctx.getValue() ? formatTime(ctx.getValue()!) : '-'),
  }),
  helper.accessor('comment', { header: () => '备注' }),
  helper.accessor('order_id', {
    header: () => '操作',
    cell: (ctx) => {
      const order = ctx.row.original;

      return (
        <Space>
          <Button
            onClick={async () => {
              const terminal = await firstValueFrom(terminal$);
              if (terminal) {
                await terminal.client.requestForResponse('CancelOrder', {
                  account_id: order.account_id,
                  order_id: order.order_id,
                  product_id: order.product_id,
                });
              }
            }}
            type="danger"
          >
            撤单
          </Button>
        </Space>
      );
    },
  }),
];

export const PendingOrderInfo = (props: {
  accountId: string;
  pendingOrderNumberChange: (v: number) => void;
}) => {
  const { accountId, pendingOrderNumberChange } = props;
  const pendingOrders = useObservableState(
    useObservable(
      pipe(
        combineLatestWith(terminal$),
        switchMap(([[accountId], terminal]) => {
          return defer(async () => {
            if (!terminal || !accountId) return [];
            const data = await terminal.client.requestForResponseData<{ account_id: string }, IOrder[]>(
              'QueryPendingOrders',
              { account_id: accountId },
            );
            return data ?? [];
          }).pipe(
            //
            retry({ delay: 3_000 }),
            repeat({ delay: 2_000 }),
          );
        }),
      ),
      [accountId],
    ),
    [] as IOrder[],
  );

  useEffect(() => {
    if (pendingOrders) {
      pendingOrderNumberChange(pendingOrders.length);
    }
  }, [pendingOrders, pendingOrderNumberChange]);

  return <DataView data={pendingOrders} columns={columns} />;
};
