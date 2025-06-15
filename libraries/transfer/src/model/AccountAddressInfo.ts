import { addDataRecordWrapper, encodePath } from '@yuants/data-model';

declare module '@yuants/data-model/lib/DataRecord' {
  export interface IDataRecordTypes {
    account_address_info: IAccountAddressInfo;
  }
}

/**
 * @public
 */
export interface IAccountAddressInfo {
  account_id: string;
  network_id: string;
  address: string;
  currency: string;
}

addDataRecordWrapper('account_address_info', (v) => {
  const now = Date.now();
  return {
    id: encodePath(v.account_id, v.network_id, v.network_id, v.currency),
    type: 'account_address_info',
    created_at: now,
    updated_at: now,
    frozen_at: null,
    tags: {
      currency: v.currency,
      account_id: v.account_id,
      network_id: v.network_id,
    },
    origin: v,
  };
});
