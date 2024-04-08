import { ITransferOrder } from '@yuants/data-model';

declare module '.' {
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
  }
}
