import { IOrder } from '@yuants/data-order';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { defer, filter, first, mergeMap, of } from 'rxjs';
import { terminal$ } from '../Network';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { IProduct } from '@yuants/data-product';
import { Space } from '@douyinfe/semi-ui';
import Form from '../Form';
import { Button, Toast } from '../Interactive';

export const ManualTradePanelContent = () => {
  const [order, setOrder] = useState<IOrder>();
  const [cancelFormData, setCancelFormData] = useState<{ order_id: string; account_id: string }>();

  const products$ = useObservable(
    mergeMap(([account_id]) =>
      account_id
        ? terminal$.pipe(
            filter((x): x is Exclude<typeof x, null> => !!x),
            first(),
            mergeMap((terminal) =>
              defer(() =>
                requestSQL<IProduct[]>(
                  terminal,
                  `select * from product where datasource_id = ${escapeSQL(account_id)}`,
                ),
              ),
            ),
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
            account_id: { type: 'string', title: '账户', format: 'account_id' },
            product_id: {
              type: 'string',
              title: '品种',
              examples: products.map((product) => product.product_id),
            },
            order_type: {
              type: 'number',
              title: '订单类型',
              default: 'MARKET',
              enum: ['MARKET', 'LIMIT', 'STOP'],
              enumNames: ['市价单', '限价单', '止损单'],
            },
            order_direction: {
              type: 'number',
              title: '订单方向',
              default: 'OPEN_LONG',
              enum: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'],
              enumNames: ['开多', '开空', '平多', '平空'],
            },
            volume: {
              type: 'number',
              title: '委托量',
            },
          },
          if: {
            properties: {
              order_type: { enum: ['LIMIT', 'STOP'] },
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
          setOrder(e.formData as IOrder);
        }}
      >
        <div />
      </Form>
      <Button
        onClick={() => {
          order &&
            terminal$
              .pipe(
                filter((x): x is Exclude<typeof x, null> => !!x),
                first(),
                mergeMap((terminal) => terminal.client.requestForResponse('SubmitOrder', order)),
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
            account_id: { type: 'string', title: '账户ID', format: 'account_id' },
            order_id: { type: 'string', title: '订单ID' },
          },
        }}
        formData={cancelFormData}
        onChange={(e) => {
          setCancelFormData(e.formData as typeof cancelFormData);
        }}
        uiSchema={{
          'ui:submitButtonOptions': {
            submitText: '取消订单',
          },
        }}
        onSubmit={() => {
          cancelFormData &&
            terminal$
              .pipe(
                filter((x): x is Exclude<typeof x, null> => !!x),
                first(),
                mergeMap((terminal) =>
                  terminal.client.requestForResponse('CancelOrder', cancelFormData as IOrder),
                ),
              )
              .forEach((res) => {
                if (res?.code === 0) {
                  Toast.success('取消成功');
                } else {
                  Toast.success(`取消失败: ${res?.code} ${res?.message}`);
                }
              });
        }}
      />
    </Space>
  );
};
