export {};
declare module '.' {
  /**
   * - Subscription related interfaces have been loaded
   * - 订阅相关接口已载入
   */
  interface IService {
    Subscribe: {
      req: {
        /**
         * `AccountInfo/FXCM-USDDemo02/21348223`
         * `Period/FXCM-USDDemo02/21348223/XAUUSD/60`
         * `Tick/FXCM-USDDemo02/21348223/XAUUSD`
         */
        channel_id: string;
        /**
         * Tags of channel: used to help server to get data parameters when requesting,
         * channel 的标志: 请求时用于辅助服务端获取数据参数，以避免服务端主动解析 channel_id
         */
        tags?: Record<string, any>;
      };
      res: IResponse;
      frame: void;
    };

    Unsubscribe: {
      req: { channel_id: string };
      res: IResponse;
      frame: void;
    };

    Feed: {
      req: {};
      res: IResponse;
      frame: { channel_id: string; data: unknown };
    };
  }
}
