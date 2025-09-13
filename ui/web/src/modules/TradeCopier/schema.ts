import { JSONSchema7 } from 'json-schema';

export const schemaOfTradeCopierConfig: JSONSchema7 = {
  type: 'object',
  properties: {
    account_id: { type: 'string', title: '账户 ID', format: 'account_id' },
    enabled: { type: 'boolean', title: '启用' },
    strategy: {
      type: 'object',
      title: '策略配置',
      properties: {
        global: {
          type: 'object',
          title: '全局默认配置',
          properties: {
            type: { type: 'string', title: '策略类型' },
            max_volume: { type: 'number', title: '最大订单量限制' },
          },
        },
        product_overrides: {
          type: 'object',
          title: '按品种覆盖的配置',
          additionalProperties: {
            type: 'object',
            properties: {
              type: { type: 'string', title: '策略类型' },
              max_volume: { type: 'number', title: '最大订单量限制' },
            },
          },
        },
      },
    },
  },
};
