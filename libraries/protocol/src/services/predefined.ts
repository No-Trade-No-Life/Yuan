declare module '.' {
  /**
   * - Global predefined interfaces (Ping, Terminate) have been loaded
   * - 全局预设接口 (Ping, Terminate) 已载入
   */
  interface IService {
    Ping: {
      req: {};
      res: IResponse<void>;
      frame: void;
    };

    Terminate: {
      req: {};
      res: IResponse<void>;
      frame: void;
    };
  }
}

export * from './metrics';
