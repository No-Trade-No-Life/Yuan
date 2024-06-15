import { IOrder } from '@yuants/data-model';

declare module '.' {
  /**
   * - Order operation interface has been loaded
   * - 订单操作接口已载入
   */
  interface IService {
    SubmitOrder: {
      req: IOrder;
      res: IResponse;
      frame: void;
    };
    ModifyOrder: {
      req: IOrder;
      res: IResponse;
      frame: void;
    };
    CancelOrder: {
      req: IOrder;
      res: IResponse;
      frame: void;
    };
  }
}
