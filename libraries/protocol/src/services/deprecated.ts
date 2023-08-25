import { IAccountInfo, IPeriod, IServiceInfo, ITerminalInfo, ITick } from '../model';

/**
 * 订阅 Periods 的请求
 *
 * @public
 */
export interface ISubscribePeriodsRequest {
  datasource_id: string;
  product_id: string;
  period_in_sec: number;
}

/**
 *  订阅 Ticks 的请求
 *
 * @public
 */
export interface ISubscribeTicksRequest {
  datasource_id: string;
  product_id: string;
}

declare module '.' {
  /**
   * - 废弃接口已载入
   */
  interface IService {
    Login: {
      req: {
        host_token: string;
        terminal_id: string;
      };
      res: IResponse;
      frame: void;
    };
    Register: {
      req: IServiceInfo;
      res: IResponse;
      frame: void;
    };
    ListAll: {
      req: {};
      res: IResponse<IServiceInfo[]>;
      frame: void;
    };

    StorageRead: {
      req: {
        key: string;
      };
      res: IResponse<string>;
      frame: void;
    };

    StorageWrite: {
      req: {
        key: string;
        value: string;
      };
      res: IResponse;
      frame: void;
    };

    /**
     * 订阅账户信息
     *
     * 被订阅方应当持续地，及时地，主动地发送账户信息
     */
    SubscribeAccountInfo: {
      req: { account_id: string };
      res: IResponse;
      frame: IAccountInfo;
    };

    SubscribePeriods: {
      req: ISubscribePeriodsRequest;
      res: IResponse;
      frame: IPeriod;
    };
    SubscribeTicks: {
      req: ISubscribeTicksRequest;
      res: IResponse;
      frame: ITick;
    };
    UpdateTerminalInfo: {
      req: ITerminalInfo;
      res: IResponse;
      frame: void;
    };

    ListHostTerminals: {
      req: {};
      res: IResponse<ITerminalInfo[]>;
      frame: void;
    };
  }
}
