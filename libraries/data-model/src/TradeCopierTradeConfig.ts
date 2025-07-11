import { UUID } from '@yuants/utils';
import { addDataRecordSchema, addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    trade_copier_trade_config: ITradeCopierTradeConfig;
  }
}

interface ITradeCopierTradeConfig {
  id?: string;
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
}

addDataRecordWrapper('trade_copier_trade_config', (x) => {
  const id = x.id || UUID();
  return {
    id,
    type: 'trade_copier_trade_config',
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: { ...x, id },
  };
});

addDataRecordSchema('trade_copier_trade_config', {
  type: 'object',
  required: ['account_id', 'product_id', 'max_volume_per_order'],
  properties: {
    account_id: {
      title: '账户 ID',
      type: 'string',
      format: 'account_id',
    },
    product_id: {
      title: '品种 ID',
      type: 'string',
    },
    max_volume_per_order: {
      title: '单笔最大手数',
      type: 'number',
    },
  },
});
