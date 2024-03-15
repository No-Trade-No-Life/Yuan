import { JSONSchema7 } from 'json-schema';

export interface ITransferOrder {
  order_id: string;
  created_at: number;
  updated_at: number;
  /** 借方账户ID */
  debit_account_id: string;
  /** 贷方账户ID */
  credit_account_id: string;
  /** 转账货币 */
  currency: string;
  /** 预期转账金额 */
  expected_amount: number;
  /** 订单状态 = "COMPLETE" | "ERROR" | "AWAIT_DEBIT" \ "AWAIT_CREDIT" */
  status: string;
  /** 超时时间戳 */
  timeout_at: number;

  /** 借方可接受的转账方式 (Routing Path) */
  debit_methods?: string[];

  /** 贷方选择的转账方式 (Routing Path) */
  credit_method?: string;
  /** 贷方发起转账的时间戳 */
  transferred_at?: number;
  /** 贷方已经发送的金额 */
  transferred_amount?: number;
  /** 转账凭证号 */
  transaction_id?: string;

  /** 借方查收到帐的时间戳 */
  received_at?: number;
  /** 借方已经收到的金额 */
  received_amount?: number;
}

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
