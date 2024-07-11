import { IAccountAddressInfo } from '@yuants/data-model';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    account_address_info: IAccountAddressInfo;
  }
}
