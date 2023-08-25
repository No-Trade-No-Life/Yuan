import { IDataRecord } from '../model';

/**
 * Request to query data records
 * 查询数据记录的请求
 *
 * @public
 */
export interface IQueryDataRecordsRequest {
  type: string;
  id?: string;
  time_range?: [number, number];
  updated_since?: number;
  tags?: Record<string, string>;
  options?: Partial<{
    skip: number;
    limit: number;
    sort: Array<[string, number]>;
  }>;
}

/**
 * Request to remove data records
 * 删除数据记录的请求·
 *
 * @public
 */
export interface IRemoveDataRecordsRequest {
  type: string;
  id: string;
}

declare module '.' {
  /**
   * - Data record related interfaces have been loaded
   * - 数据记录相关接口已载入
   */
  interface IService {
    UpdateDataRecords: {
      req: IDataRecord[];
      res: IResponse;
      frame: void;
    };

    QueryDataRecords: {
      req: IQueryDataRecordsRequest;
      res: IResponse;
      frame: IDataRecord[];
    };

    RemoveDataRecords: {
      req: IRemoveDataRecordsRequest;
      res: IResponse;
      frame: void;
    };
  }
}
