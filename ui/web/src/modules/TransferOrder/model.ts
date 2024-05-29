import { JSONSchema7 } from 'json-schema';

export const schema: JSONSchema7 = {
  type: 'object',
  properties: {
    order_id: {
      type: 'string',
      format: 'uuid',
    },
    created_at: {
      type: 'number',
      format: 'timestamp',
    },
    updated_at: {
      type: 'number',
      format: 'timestamp',
    },
    credit_account_id: {
      type: 'string',
      title: '贷方账户',
      format: 'account_id',
    },
    debit_account_id: {
      type: 'string',
      title: '借方账户',
      format: 'account_id',
    },
    currency: {
      type: 'string',
    },
    expected_amount: {
      type: 'number',
    },
    status: {
      type: 'string',
      enum: ['INIT', 'AWAIT_DEBIT', 'AWAIT_CREDIT', 'COMPLETE', 'ERROR'],
      default: 'INIT',
    },
    current_tx_state: {
      type: 'string',
    },
    timeout_at: {
      type: 'number',
      format: 'timestamp',
    },
    debit_methods: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    credit_method: {
      type: 'string',
    },
    transferred_at: {
      type: 'number',
      format: 'timestamp',
    },
    transferred_amount: {
      type: 'number',
    },
    transaction_id: {
      type: 'string',
    },
    received_at: {
      type: 'number',
      format: 'timestamp',
    },
    received_amount: {
      type: 'number',
    },
  },
};
