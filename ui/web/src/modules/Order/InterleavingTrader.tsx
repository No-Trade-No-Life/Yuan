import { Badge, Button, Descriptions, Space, Typography } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { InlineAccountId, useAccountInfo } from '../AccountInfo';
import Form from '../Form';
import { registerPage } from '../Pages';
import { InlineProductId } from '../Products/InlineProductId';
import { terminal$, useTick } from '../Terminals';

interface IInterleavingConfigItem {
  account_id: string;
  datasource_id: string;
  product_id: string;
  order_type: string;
  order_direction: string;
  volume: number;
}

interface IInterleavingConfig {
  count: number;
  items: IInterleavingConfigItem[];
}

const schema = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            format: 'account_id',
          },
          datasource_id: {
            type: 'string',
          },
          product_id: {
            type: 'string',
          },
          order_type: {
            type: 'string',
            examples: ['LIMIT', 'MARKET'],
          },
          order_direction: {
            type: 'string',
            examples: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'],
          },
          volume: {
            type: 'number',
          },
        },
      },
    },
  },
};

interface IState {
  currentRound: number;
  currentIdx: number;
  message: string;
}

const initState: IState = {
  currentRound: 0,
  currentIdx: -1,
  message: '',
};

registerPage('InterleavingTrader', () => {
  const [config, setConfig] = useState<IInterleavingConfig>();
  const [state, setState] = useState<IState>(initState);
  const terminal = useObservableState(terminal$);
  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Form
        formData={config}
        onChange={(e) => {
          setConfig(e.formData);
        }}
        schema={schema}
      >
        <div></div>
      </Form>
      {config?.items?.map((item, idx) => (
        <InterleavingAccountStatus item={item} config={config} state={state} index={idx} />
      ))}
      <Typography.Paragraph type="danger">{state.message}</Typography.Paragraph>
      <Space>
        {state.currentRound} / {state.currentIdx}
        <Button
          onClick={async () => {
            if (!terminal || !config) return;
            setState((x) => ({ ...x, currentRound: 0, currentIdx: -1, message: '' }));
            for (let i = 0; i < config.count; i++) {
              setState((x) => ({ ...x, currentRound: x.currentRound + 1, currentIdx: -1 }));
              for (const item of config.items) {
                setState((x) => ({ ...x, currentIdx: x.currentIdx + 1 }));
                try {
                  const res = await lastValueFrom(
                    terminal.requestService('SubmitOrder', {
                      account_id: item.account_id,
                      product_id: item.product_id,
                      volume: item.volume,
                      order_type: item.order_type,
                      order_direction: item.order_direction,
                    }),
                  );
                  if (res.res && res.res.code !== 0) {
                    setState((x) => ({ ...x, message: res.res!.message }));
                    return;
                  }
                } catch (e) {
                  setState((x) => ({ ...x, message: `${e}` }));
                  return;
                }
              }
            }
            setState((x) => ({ ...x, currentRound: 0, currentIdx: -1 }));
          }}
        >
          开始
        </Button>
      </Space>
    </Space>
  );
});

const InterleavingAccountStatus = (props: {
  item: IInterleavingConfigItem;
  config: IInterleavingConfig;
  state: IState;
  index: number;
}) => {
  const { item, config, state, index } = props;
  const accountInfo = useObservableState(useAccountInfo(item.account_id));
  const tick = useObservableState(
    useMemo(() => useTick(item.datasource_id, item.product_id), [item.datasource_id, item.product_id]),
  );

  const volume =
    accountInfo?.positions
      .filter((pos) => pos.product_id === item.product_id)
      .reduce((acc, cur) => acc + (cur.direction === 'LONG' ? 1 : -1) * cur.volume, 0) ?? 0;

  const delta_volume =
    (item.order_direction === 'OPEN_LONG' || item.order_direction === 'CLOSE_SHORT' ? 1 : -1) * item.volume;

  const next_target_volume = volume + delta_volume;
  const final_target_volume = volume + (config.count - Math.max(0, state.currentIdx)) * delta_volume;

  //   const order: IOrder = {
  //     account_id: accountInfo?.account_id ?? '',
  //     product_id: item.product_id,
  //     volume: item.volume,
  //     order_type: item.order_type,
  //     order_direction: item.order_direction,
  //     //   price
  //   };

  return (
    <Descriptions
      data={[
        //
        {
          key: '状态',
          value:
            index === state.currentIdx ? (
              <span>
                <Badge dot type="primary" />
                进行中
              </span>
            ) : (
              <span>
                <Badge dot type="danger" /> 等待中
              </span>
            ),
        },
        { key: '账户', value: <InlineAccountId account_id={item.account_id} /> },
        {
          key: '品种',
          value: <InlineProductId product_id={item.product_id} datasource_id={item.datasource_id} />,
        },
        { key: '当前仓位', value: volume },
        { key: '下次仓位', value: next_target_volume },
        { key: '最终仓位', value: final_target_volume },
        { key: '当前报价', value: `${tick?.ask} ${tick?.price} ${tick?.bid}` },
        { key: '订单方向', value: item.order_direction },
        { key: '订单类型', value: item.order_type },
      ]}
    ></Descriptions>
  );
};
