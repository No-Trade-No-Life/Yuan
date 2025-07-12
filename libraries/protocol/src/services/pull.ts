import { IOrder, IPeriod, ITick } from '@yuants/data-model';
/**
 * Request to query Ticks
 * 查询 Ticks 的请求
 *
 * @public
 */
export interface IQueryTicksRequest {
  datasource_id: string;
  product_id: string;
  start_time_in_us: number;
  end_time_in_us: number;
  /**
   * Request to pull from the source to ensure data integrity, but with lower latency and stability.
   * 要求从源头拉取，保证数据完整性，但延迟和稳定性都较低。
   *
   * If not required to pull from the source, data will be extracted from cache and database.
   * 如果不要求从源头拉取，会考虑从缓存和数据库中提取数据。
   *
   * When the value is null, the semantics are equivalent to false.
   * 为空值时，语义等同于 false
   */
  pull_source?: boolean;
}
/**
 * Request to query Periods
 * 查询 Periods 的请求
 *
 * @public
 */
export interface IQueryPeriodsRequest {
  datasource_id: string;
  product_id: string;
  period_in_sec: number;
  start_time_in_us: number;
  end_time_in_us: number;
  /**
   * Request to pull from the source to ensure data integrity, but with lower latency and stability.
   * 要求从源头拉取，保证数据完整性，但延迟和稳定性都较低。
   *
   * If not required to pull from the source, data will be extracted from cache and database.
   * 如果不要求从源头拉取，会考虑从缓存和数据库中提取数据。
   *
   * When the value is null, the semantics are equivalent to false.
   * 为空值时，语义等同于 false
   */
  pull_source?: boolean;
}

/**
 * Request to query history orders
 * 查询历史订单的请求
 *
 * @public
 */
export interface IQueryHistoryOrdersRequest {
  account_id: string;
  /**
   * Lower bound of the timestamp of historical orders.
   * 历史订单的时间戳的下界
   *
   * When the value is null, it represents a full query.
   * 为空时，表示全量查询
   */
  start_time_in_us?: number;
  /**
   * Request to pull from the source to ensure data integrity, but with lower latency and stability.
   * 要求从源头拉取，保证数据完整性，但延迟和稳定性都较低。
   *
   * If not required to pull from the source, data will be extracted from cache and database.
   * 如果不要求从源头拉取，会考虑从缓存和数据库中提取数据。
   *
   * When the value is null, the semantics are equivalent to false.
   * 为空值时，语义等同于 false
   */
  pull_source?: boolean;
}

/**
 * Request to query products
 * 查询品种信息的请求
 *
 * @public
 */
export interface IQueryProductsRequest {
  datasource_id?: string;
  pull_source?: boolean;
}

declare module '.' {
  /**
   * - Query related interfaces have been loaded
   * - 查询相关接口已载入
   */
  interface IService {
    QueryHistoryOrders: {
      req: IQueryHistoryOrdersRequest;
      res: IResponse<IOrder[]>;
      frame: void;
    };
    QueryTicks: {
      req: IQueryTicksRequest;
      res: IResponse<ITick[]>;
      frame: void;
    };
    QueryPeriods: {
      req: IQueryPeriodsRequest;
      res: IResponse<IPeriod[]>;
      frame: void;
    };
  }
}
