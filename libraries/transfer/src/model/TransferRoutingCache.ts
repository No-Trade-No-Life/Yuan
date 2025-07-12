/**
 * @public
 */
export interface ITransferPair {
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
}

/**
 * @public
 */
export interface ITransferRoutingCache {
  credit_account_id: string;
  debit_account_id: string;
  routing_path: ITransferPair[];
}
