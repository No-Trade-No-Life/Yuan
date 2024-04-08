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
    debit_account_id: {
      type: 'string',
      format: 'account-id',
    },
    credit_account_id: {
      type: 'string',
      format: 'account-id',
    },
    currency: {
      type: 'string',
    },
    expected_amount: {
      type: 'number',
    },
    status: {
      type: 'string',
      enum: ['AWAIT_DEBIT', 'AWAIT_CREDIT', 'COMPLETE', 'ERROR'],
      default: 'AWAIT_DEBIT',
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
