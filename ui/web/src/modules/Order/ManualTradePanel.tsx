import { Button, Space, Toast } from '@douyinfe/semi-ui';
import { IOrder, OrderDirection, OrderType } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { first, mergeMap, of } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { openPage } from '../../layout-model';
import { accountIds$ } from '../AccountInfo/model';
import { registerCommand } from '../CommandCenter/CommandCenter';
import { Form } from '../Form';

export const ManualTradePanel = React.memo(() => {
  const [order, setOrder] = useState(undefined as IOrder | undefined);
  const [cancelFormData, setCancelFormData] = useState(
    undefined as
      | {
          exchange_order_id: string;
          account_id: string;
        }
      | undefined,
  );
  const accountIds = useObservableState(accountIds$, []);

  const products$ = useObservable(
    mergeMap(([account_id]) =>
      account_id
        ? terminal$.pipe(
            first(),
            mergeMap((terminal) => terminal.queryProducts({ datasource_id: account_id }, 'MongoDB')),
          )
        : of([]),
    ),
    [order?.account_id],
  );

  const products = useObservableState(products$, []);

  return (
    <Space vertical align="start">
      <Form
        schema={{
          type: 'object',
          properties: {
            account_id: { type: 'string', title: '账户', enum: accountIds },
            product_id: {
              type: 'string',
              title: '品种',
              examples: products.map((product) => product.product_id),
            },
            type: {
              type: 'number',
              title: '订单类型',
              default: OrderType.MARKET,
              enum: [OrderType.MARKET, OrderType.LIMIT, OrderType.STOP],
              enumNames: ['市价单', '限价单', '止损单'],
            },
            direction: {
              type: 'number',
              title: '订单方向',
              default: OrderDirection.OPEN_LONG,
              enum: [
                OrderDirection.OPEN_LONG,
                OrderDirection.OPEN_SHORT,
                OrderDirection.CLOSE_LONG,
                OrderDirection.CLOSE_SHORT,
              ],
              enumNames: ['开多', '开空', '平多', '平空'],
            },
            volume: {
              type: 'number',
              title: '委托量',
            },
          },
          if: {
            properties: {
              type: { enum: [OrderType.LIMIT, OrderType.STOP] },
            },
          },
          then: {
            properties: {
              price: { type: 'number', title: '委托价' },
            },
          },
        }}
        formData={order}
        onChange={(e) => {
          setOrder(e.formData);
        }}
      >
        <div></div>
      </Form>
      <Button
        onClick={() => {
          order &&
            terminal$
              .pipe(
                first(),
                mergeMap((terminal) => terminal.submitOrder(order)),
              )
              .forEach((res) => {
                if (res?.code === 0) {
                  Toast.success('下单成功');
                } else {
                  Toast.success(`下单失败: ${res?.code} ${res?.message}`);
                }
              });
        }}
      >
        下单
      </Button>
      <Form
        schema={{
          type: 'object',
          properties: {
            account_id: { type: 'string', title: '账户ID', enum: accountIds },
            exchange_order_id: { type: 'string', title: '订单ID' },
          },
        }}
        formData={cancelFormData}
        onChange={(e) => {
          setCancelFormData(e.formData);
        }}
        uiSchema={{
          'ui:submitButtonOptions': {
            submitText: '取消订单',
          },
        }}
        onSubmit={(e) => {
          cancelFormData &&
            terminal$
              .pipe(
                first(),
                mergeMap((terminal) => terminal.cancelOrder(cancelFormData as IOrder)),
              )
              .forEach((res) => {
                if (res?.code === 0) {
                  Toast.success('取消成功');
                } else {
                  Toast.success(`取消失败: ${res?.code} ${res?.message}`);
                }
              });
        }}
      ></Form>
    </Space>
  );
});

registerCommand('ManualTradePanel', () => {
  openPage('ManualTradePanel');
});
