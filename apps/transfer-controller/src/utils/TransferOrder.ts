import { IDataRecord, ITransferOrder } from '@yuants/data-model';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    transfer_order: ITransferOrder;
  }
}

export function wrapTransferOrder(order: ITransferOrder): IDataRecord<ITransferOrder> {
  return {
    id: order.order_id,
    type: 'transfer_order',
    created_at: order.created_at,
    updated_at: order.updated_at,
    frozen_at: null,
    tags: {
      credit_account_id: order.credit_account_id,
      debit_account_id: order.debit_account_id,
      status: order.status,
    },
    origin: order,
  };
}
