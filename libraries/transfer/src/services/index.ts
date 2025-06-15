import { ITransferOrder } from '../model';

export {};

declare module '@yuants/protocol/lib/services' {
  /**
   * - Transfer interface have been loaded
   * - 转账接口已载入
   */
  interface IService {
    Transfer: {
      req: ITransferOrder;
      res: IResponse;
      frame: void;
    };
    // 发起转账
    TransferApply: {
      req: ITransferOrder;
      res: IResponse<{ state: string; context?: string; transaction_id?: string; message?: string }>;
      frame: void;
    };
    // 核验转账 (对账)
    TransferEval: {
      req: ITransferOrder;
      res: IResponse<{ state: string; context?: string; received_amount?: number } | void>;
      frame: void;
    };
  }
}
