import { JSONSchema7 } from 'json-schema';
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
  json_schema?: JSONSchema7;
  include_expired?: boolean;
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

/**
 * Request to copy data records to receiver terminal.
 *
 * Response when all data records arrived the target.
 *
 * 1. The source terminal asks the target terminal to copy data records to the receiver terminal.
 * 2. The target terminal push data records to the receiver terminal.
 *    the receiver terminal MUST implement `UpdateDataRecords`.
 *    the target terminal serially micro-batching calls `UpdateDataRecords` to the receiver terminal.
 * 3. After all data records arrived the receiver terminal, the target terminal responses to the source terminal.
 *
 * E1. the target terminal SHOULD response error if any error occurred during the process.
 *
 * Recommended if the source terminal does not care about the content of data records.
 *
 * @public
 */
export interface ICopyDataRecordsRequest extends IQueryDataRecordsRequest {
  /**
   * the receiver terminal that will receive `UpdateDataRecords` messages.
   */
  receiver_terminal_id: string;
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
    CopyDataRecords: {
      req: ICopyDataRecordsRequest;
      res: IResponse;
      frame: void;
    };
  }
}
