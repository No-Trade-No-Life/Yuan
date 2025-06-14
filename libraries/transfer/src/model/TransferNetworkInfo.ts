import { addDataRecordWrapper, encodePath } from '@yuants/data-model';

declare module '@yuants/data-model/lib/DataRecord' {
  export interface IDataRecordTypes {
    transfer_network_info: ITransferNetworkInfo;
  }
}

/**
 * @public
 */
export interface ITransferNetworkInfo {
  network_id: string;
  /** 手续费 */
  commission: number;
  /** 手续费货币 */
  currency: string;
  /** 网络超时时间 */
  timeout?: number;
}

addDataRecordWrapper('transfer_network_info', (v) => {
  const now = Date.now();
  return {
    id: encodePath(v.network_id, v.currency),
    type: 'transfer_network_info',
    created_at: now,
    updated_at: now,
    frozen_at: null,
    tags: {
      currency: v.currency,
      network_id: v.network_id,
    },
    origin: v,
  };
});
