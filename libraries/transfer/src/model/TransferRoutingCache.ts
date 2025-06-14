import { addDataRecordWrapper } from '@yuants/data-model';

declare module '@yuants/data-model/lib/DataRecord' {
  export interface IDataRecordTypes {
    transfer_routing_cache: ITransferRoutingCache;
  }
}

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

addDataRecordWrapper('transfer_routing_cache', (origin) => ({
  id: `${origin.credit_account_id}-${origin.debit_account_id}`,
  type: 'transfer_routing_cache',
  created_at: Date.now(),
  updated_at: Date.now(),
  frozen_at: null,
  tags: {
    credit_account_id: origin.credit_account_id,
    debit_account_id: origin.debit_account_id,
  },
  origin,
}));
