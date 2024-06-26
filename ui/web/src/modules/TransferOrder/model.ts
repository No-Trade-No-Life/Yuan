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
      enum: ['INIT', 'ONGOING', 'COMPLETE', 'ERROR'],
      default: 'INIT',
    },
    current_amount: {
      type: 'number',
    },
    current_tx_account_id: {
      type: 'string',
      format: 'account_id',
    },
    current_tx_address: {
      type: 'string',
    },
    current_tx_state: {
      type: 'string',
    },
    current_network_id: {
      type: 'string',
    },
    current_rx_account_id: {
      type: 'string',
      format: 'account_id',
    },
    current_rx_address: {
      type: 'string',
    },
    current_rx_state: {
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
