import { Registry } from 'promjs/registry';

/**
 * Prometheus Metrics Registry
 * @public
 */
export const PromRegistry = new Registry();

declare module '.' {
  /**
   * - Metrics interface has been loaded
   * - 打点接口 (Metrics) 已载入
   */
  interface IService {
    Metrics: {
      req: {};
      res: IResponse<{ metrics: string }>;
      frame: void;
    };
  }
}
