/**
 * ITransferOrder represents the transfer order, will be updated by both side during the transfer process
 *
 * ITransferOrder 表示转账订单，将在转账过程中双方更新
 *
 * @public
 */
export interface ITransferOrder {
  /**
   * Order ID
   *
   * 订单 ID
   */
  order_id: string;
  /**
   * Created Timestamp
   *
   * 创建时间戳
   */
  created_at: string;
  /**
   * Updated Timestamp
   *
   * 最后更新时间戳
   */
  updated_at: string;
  /**
   * Credit Account ID
   *
   * 贷方账户 ID (付款方)
   */
  credit_account_id: string;
  /**
   * Debit Account ID
   *
   * 借方账户 ID (收款方)
   */
  debit_account_id: string;
  /**
   * Currency
   *
   * 转账货币
   */
  currency: string;
  /**
   * Expected Amount
   *
   * 预期转账金额
   */
  expected_amount: number;
  /**
   * Order Status
   *
   * - `"COMPLETE"` - Transfer completed
   * - `"ERROR"` - Transfer failed, need to check the error message, need human intervention
   * - `"ONGOING"` - Transfer is pending, need to wait
   */
  status: string;
  /**
   * Error Message for Human-reading
   *
   * 人类可读的错误信息
   */
  error_message?: string;
  /**
   * Timeout Timestamp
   *
   * 超时时间戳
   * @deprecated use the timeout value provided by the specific network instead
   */
  timeout_at?: string;

  /**
   * The acceptable ways for Debit Account to receive the transfer (Routing Path)
   *
   * 借方可接受的转账方式 (Routing Path)
   * @deprecated replaced by transfer network refactor
   */
  debit_methods?: string[];

  /**
   * The confirmed way for credit account to send the transfer (Routing Path)
   *
   * 贷方选择的转账方式 (Routing Path)
   * @deprecated replaced by transfer network refactor
   */
  credit_method?: string;

  /**
   * Transfer Initiated Timestamp
   *
   * 贷方发起转账的时间戳
   * @deprecated replaced by transfer network refactor
   */
  transferred_at?: number;
  /**
   * Transfer Initiated Amount
   *
   * 贷方已经发送的金额
   * @deprecated replaced by transfer network refactor
   */
  transferred_amount?: number;
  /**
   * Transaction ID for confirmation
   *
   * 转账凭证号
   * @deprecated replaced by transfer network refactor
   */
  transaction_id?: string;

  /**
   * Received Timestamp for Debit Account
   *
   * 借方查收到帐的时间戳
   * @deprecated replaced by transfer network refactor
   */
  received_at?: number;
  /**
   * Received Amount for Debit Account
   *
   * 借方已经收到的金额
   * @deprecated replaced by transfer network refactor
   */
  received_amount?: number;

  /**
   * 转账路径 (是 (AccountId | Address | NetworkId)[] 的 encodePath 编码)
   * 不使用外键，而是內联保存，作为历史记录
   */
  routing_path?: {
    /** 发起转账的账户ID */
    tx_account_id?: string;
    /** 查收转账的账户ID */
    rx_account_id?: string;
    /** 发起转账的地址 */
    tx_address?: string;
    /** 查收转账的地址 */
    rx_address?: string;
    /** 网络 ID */
    network_id?: string;
  }[];

  /**
   * 当前正在处理的转账路径索引
   */
  current_routing_index?: number;

  /** 当前正在发起转账的账户ID */
  current_tx_account_id?: string;
  /** 当前正在查收转账的账户ID */
  current_rx_account_id?: string;
  /** 当前正在发起转账的地址 */
  current_tx_address?: string;
  /** 当前正在查收转账的地址 */
  current_rx_address?: string;
  /** 当前网络 ID */
  current_network_id?: string;
  /** 当前转账的状态 (INIT -\> ...? -\> COMPLETE), ERROR */
  current_tx_state?: string;
  /** 当前转账的 transaction id */
  current_transaction_id?: string;
  /** 当前转账状态下用于流转状态的上下文信息 */
  current_tx_context?: string;
  /** 当前查账的状态 (INIT -\> ...? -\> COMPLETE), ERROR */
  current_rx_state?: string;
  /** 当前查账状态下用于流转状态的上下文信息 */
  current_rx_context?: string;
  /** 当前转账开始时间 */
  current_step_started_at?: string;

  /** 当前转账数目 */
  current_amount?: number;
}
