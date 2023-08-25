export {};

declare module '.' {
  /**
   * - Notify interface has been loaded
   * - 通知接口 (Notify) 已载入
   */
  interface IService {
    Notify: {
      req: {
        /**
         * Receiver ID parsed by Transport
         * 由 Transport 解析的接收者 ID
         */
        receiver_id: string;
        /**
         * Message content
         * 消息正文
         */
        message: string;
      };
      res: IResponse;
      frame: void;
    };
  }
}
