import { IconRefresh } from '@douyinfe/semi-icons';
import { Popconfirm, Space } from '@douyinfe/semi-ui';
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
          <Popconfirm
            title="确定是否要保存此修改？"
            content="此修改将不可逆"
            position="right"
            onConfirm={async () => {
              const terminal = await firstValueFrom(terminal$);
              if (terminal) {
                await terminal.client.requestForResponse('CancelOrder', {
                  account_id: order.account_id,
                  order_id: order.order_id,
                  product_id: order.product_id,
                });
              }
            }}
          >
            <div>
              <Button type="danger">撤单</Button>
            </div>
          </Popconfirm>
        </Space>
      );
    },
  }),
];

export const PendingOrderInfo = (props: { pendingOrders: IOrder[] }) => {
  const { pendingOrders } = props;

  return <DataView data={pendingOrders} columns={columns} />;
};
