/**
 * ITransferOrder represents the transfer order, will be updated by both side during the transfer process
 * ITransferOrder 表示转账订单，将在转账过程中双方更新
 * @public
 */
export interface ITransferOrder {
  order_id: string;
  created_at: number;
  debit_account_id: string;
  credit_account_id: string;
  currency: string;
  /** 预期转账金额 */
  expected_amount: number;
  /** 订单状态 = "COMPLETE" | "ERROR" | "AWAIT_DEBIT" \ "AWAIT_CREDIT" */
  status: string;
  /** 超时时间戳 */
  timeout_at: number;

  /** 借方可接受的转账方式 (Routing Path) */
  credit_methods?: string[];

  /** 贷方选择的转账方式 (Routing Path) */
  debit_method?: string;

  /** 贷方发起转账的时间戳 */
  transferred_at?: number;
  /** 贷方已经发送的金额 */
  transferred_amount?: number;

  /** 借方查收到帐的时间戳 */
  received_at?: number;
  /** 借方已经收到的金额 */
  received_amount?: number;
}

declare module '.' {
  /**
   * - Transfer operation interface has been loaded
   * - 转账操作接口已载入
   */
  interface IService {
    Transfer: {
      req: ITransferOrder;
      res: IResponse;
      frame: void;
    };
  }
}
