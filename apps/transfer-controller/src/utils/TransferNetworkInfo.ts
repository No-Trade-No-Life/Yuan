import { ITransferNetworkInfo } from '@yuants/data-model';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    transfer_network_info: ITransferNetworkInfo;
  }
}
