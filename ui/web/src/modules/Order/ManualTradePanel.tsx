import { Button, Space, Toast } from '@douyinfe/semi-ui';
import { IOrder } from '@yuants/data-model';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { filter, first, mergeMap, of } from 'rxjs';
import { Form } from '../Form';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

registerPage('ManualTradePanel', () => {
  const [order, setOrder] = useState(undefined as IOrder | undefined);
  const [cancelFormData, setCancelFormData] = useState(
    undefined as
      | {
          order_id: string;
          account_id: string;
        }
      | undefined,
  );

  const products$ = useObservable(
    mergeMap(([account_id]) =>
      account_id
        ? terminal$.pipe(
            filter((x): x is Exclude<typeof x, null> => !!x),
            first(),
            mergeMap((terminal) => terminal.queryProducts({ datasource_id: account_id })),
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
                filter((x): x is Exclude<typeof x, null> => !!x),
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
            account_id: { type: 'string', title: '账户ID', format: 'account_id' },
            order_id: { type: 'string', title: '订单ID' },
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
                filter((x): x is Exclude<typeof x, null> => !!x),
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
