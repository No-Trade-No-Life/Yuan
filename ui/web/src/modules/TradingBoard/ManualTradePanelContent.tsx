import { IOrder } from '@yuants/data-order';
import { MutableRefObject, useMemo, useRef, useState } from 'react';
import { defer, filter, first, firstValueFrom, mergeMap, of } from 'rxjs';
import { terminal$ } from '../Network';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { IProduct } from '@yuants/data-product';
import { Form, Radio, RadioGroup, Space, TabPane, Tabs } from '@douyinfe/semi-ui';
// import Form from '../Form';
import { Button, Toast } from '../Interactive';
import styles from './style.module.css';
import { decodePath } from '@yuants/utils';
import { RadioChangeEvent } from '@douyinfe/semi-ui/lib/es/radio';

interface Props {
  productId: string;
  accountId: string;
}

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

export const ManualTradePanelContent = (props: Props) => {
  const { productId, accountId } = props;
  const [actionDirection, setActionDirection] = useState<'OPEN' | 'CLOSE'>('OPEN');
  const [orderType, setOrderType] = useState('LIMIT');
  const formRef = useRef<Form<any>>(null);

  const [productType] = useMemo(() => {
    if (productId) {
      return decodePath(productId);
    }
    return [];
  }, [productId]);

  const onSubmit = async (order_direction: OrderDirection) => {
    try {
      const data = await formRef.current?.formApi.validate();
      if (!accountId || !productId) {
        throw new Error('缺少accountID或者productId');
      }
      const order = {
        ...data,
        order_direction,
        order_type: orderType,
        account_id: accountId,
        product_id: productId,
      };
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        const result = await terminal.client.requestForResponse('SubmitOrder', order);
        if (result.code === 0) {
          Toast.success('下单成功');
        } else {
          Toast.success('下单失败');
        }
      }
    } catch (e) {
      Toast.error('操作失败');
    }
  };

  const onActionTypeChange = (e: RadioChangeEvent) => {
    setActionDirection(e.target.value);
  };

  return (
    <Space vertical align="start" style={{ width: '100%', padding: '14px 12px', boxSizing: 'border-box' }}>
      <RadioGroup
        type="pureCard"
        onChange={onActionTypeChange}
        value={actionDirection}
        direction="horizontal"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}
      >
        <div className={styles.openPosition} style={{ flexGrow: '1' }}>
          <Radio value={'OPEN'} style={{ width: '100%' }}>
            开仓
          </Radio>
        </div>
        <div className={styles.closePosition} style={{ flexGrow: '1' }}>
          <Radio value={'CLOSE'} style={{ width: '100%' }}>
            平仓
          </Radio>
        </div>
      </RadioGroup>
      <Tabs activeKey={orderType} onChange={setOrderType} style={{ width: '100%' }}>
        <TabPane tab="限价委托" itemKey="LIMIT" />
        <TabPane tab="市价委托" itemKey="MARKET" />
        <TabPane tab="止盈止损" itemKey="STOP" />
      </Tabs>
      <Form style={{ width: '100%' }} onValueChange={(values) => {}} ref={formRef}>
        <Form.InputNumber
          field="price"
          label="价格"
          disabled={orderType === 'MARKET'}
          style={{ width: '100%' }}
          hideButtons
          rules={
            orderType !== 'MARKET'
              ? [
                  { required: true, message: '请输入下单数量' },
                  { type: 'number', message: '请输入数字' },
                  { validator: (rule, value) => value > 0, message: '数量要大于0' },
                ]
              : undefined
          }
        />
        <Form.InputNumber
          style={{ width: '100%' }}
          hideButtons
          field="volume"
          label="数量"
          rules={[
            { required: true, message: '请输入下单数量' },
            { type: 'number', message: '请输入数字' },
            { validator: (rule, value) => value > 0, message: '数量要大于0' },
          ]}
        />
        <Space style={{ width: '100%', display: 'flex' }}>
          {actionDirection === 'OPEN' && (
            <>
              <Button
                onClick={() => onSubmit('OPEN_LONG')}
                style={{ flexGrow: 1, backgroundColor: '#26a69a', color: 'white' }}
              >
                {productType?.toLocaleUpperCase().includes('SOPT') ? '买入' : '开多'}
              </Button>
              {!productType?.toLocaleUpperCase().includes('SOPT') && (
                <Button
                  onClick={() => onSubmit('OPEN_SHORT')}
                  style={{ flexGrow: 1, backgroundColor: '#ef5350', color: 'white' }}
                >
                  开空
                </Button>
              )}
            </>
          )}
          {actionDirection === 'CLOSE' && (
            <>
              <Button
                onClick={() => onSubmit('CLOSE_LONG')}
                style={{ flexGrow: 1, backgroundColor: '#ef5350', color: 'white' }}
              >
                {productType?.toLocaleUpperCase().includes('SOPT') ? '卖出' : '平多'}
              </Button>
              {!productType?.toLocaleUpperCase().includes('SOPT') && (
                <Button
                  onClick={() => onSubmit('CLOSE_SHORT')}
                  style={{ flexGrow: 1, backgroundColor: '#26a69a', color: 'white' }}
                >
                  平空
                </Button>
              )}
            </>
          )}
        </Space>
      </Form>
      {/* <Form
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
      </Form> */}
      {/* <Button
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
      </Button> */}
    </Space>
  );
};
