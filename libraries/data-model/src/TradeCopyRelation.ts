import { UUID } from '@yuants/utils';
import { addDataRecordSchema, addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    trade_copy_relation: ITradeCopyRelation;
  }
}
interface ITradeCopyRelation {
  id?: string;
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  /** 根据正则表达式匹配头寸的备注 (黑名单) */
  exclusive_comment_pattern?: string;
  disabled?: boolean;
}

addDataRecordWrapper('trade_copy_relation', (x) => {
  const id = x.id || UUID();
  return {
    id,
    type: 'trade_copy_relation',
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: { ...x, id },
  };
});

addDataRecordSchema('trade_copy_relation', {
  type: 'object',
  required: ['source_account_id', 'source_product_id', 'target_account_id', 'target_product_id', 'multiple'],
  properties: {
    source_account_id: {
      title: '源账户 ID',
      type: 'string',
      format: 'account_id',
    },
    source_product_id: {
      title: '源品种 ID',
      type: 'string',
    },
    target_account_id: {
      title: '目标账户 ID',
      type: 'string',
      format: 'account_id',
    },
    target_product_id: {
      title: '目标品种 ID',
      type: 'string',
    },
    multiple: {
      title: '倍数',
      type: 'number',
    },
    exclusive_comment_pattern: {
      title: '头寸备注黑名单模式',
      description:
        '[高级] 请填写合法的JS正则表达式。如果头寸匹配了此模式，此头寸不会被跟单。留空表示不过滤。高级配置，请咨询技术支持后妥善配置！',
      type: 'string',
      format: 'regex',
    },
    disabled: {
      type: 'boolean',
    },
  },
});
