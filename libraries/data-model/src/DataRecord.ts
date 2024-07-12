import { JSONSchema7 } from 'json-schema';

/**
 * Data Record
 * 数据记录
 *
 * @public
 */
export interface IDataRecord<T = unknown> {
  /**
   * Record ID
   * 记录的标识符
   */
  id: string;
  /**
   * Record type
   * 记录的类型
   *
   * Different types should have consistent schema and are recommended to be stored in different tables to avoid excessive index space usage in the table
   * 不同的类型应当具有一致的 schema，并推荐存储到不同的表中，避免该表使用的索引空间增长过快
   */
  type: string;
  /**
   * Timestamp when the record was created (in ms)
   * 记录被创建的时间戳 (in ms)
   *
   * null represents -Infinity, which means infinitely far in the past
   * null 代表 -Infinity, 即过去的无穷远处
   */
  created_at: number | null;
  /**
   * Timestamp when the record was updated (in ms)
   * 记录更新的时间戳 (in ms)
   *
   * When there are multiple copies of the same record, the largest value of this field should be used.
   * 同一记录存在多份时，应以此字段最大者为准。
   */
  updated_at: number;
  /**
   * Timestamp when the record was frozen (in ms)
   * 记录冻结的时间戳 (in ms)
   *
   * After this point in time, the record will no longer be updated and can be cached on any terminal.
   * 在此时间点之后，记录将不再更新，可以任意被缓存到各终端
   *
   * null represents Infinity, which means infinitely far in the future.
   * null 代表 Infinity, 即未来的无穷远处
   */
  frozen_at: number | null;

  /**
   * Timestamp when the record will expire (in ms)
   * 记录过期的时间戳 (in ms)
   *
   * After this point in time, the record will be deleted.
   * 在此时间点之后，记录将被删除
   *
   * undefined represents Infinity, which means infinitely far in the future.
   * undefined 代表 Infinity, 即未来的无穷远处
   */
  expired_at?: number;
  /**
   * Fields that can be used as quick search conditions
   * 可以作为快速检索条件的字段
   *
   * When stored, the value will be converted to a string.
   * 存储时，值会被 toString
   */
  tags: Record<string, string>;
  /**
   * The original value of the record, which does not support efficient retrieval.
   */
  origin: T;
}

/**
 * Data Record Types Dictionary
 *
 * @public
 */
export interface IDataRecordTypes {}

const DataRecordWrappers = new Map<string, (v: any) => IDataRecord<any>>();

/**
 * register data record wrapper
 * @param type - data record type
 * @param wrapper - data record wrapper
 *
 * @public
 */
export const addDataRecordWrapper = <K extends keyof IDataRecordTypes>(
  type: K,
  wrapper: (v: IDataRecordTypes[K]) => IDataRecord<IDataRecordTypes[K]>,
) => {
  DataRecordWrappers.set(type, wrapper);
};

/**
 * get data record wrapper
 *
 * @param type - data record type
 *
 * @public
 */
export const getDataRecordWrapper = <K extends keyof IDataRecordTypes>(
  type: K,
): ((v: IDataRecordTypes[K]) => IDataRecord<IDataRecordTypes[K]>) | undefined => {
  return DataRecordWrappers.get(type) as any;
};

const DataRecordSchemas = new Map<string, JSONSchema7>();

/**
 * register data record schema
 * @param type - data record type
 * @param schema - data record schema
 *
 * @public
 */
export const addDataRecordSchema = <K extends keyof IDataRecordTypes>(type: K, schema: JSONSchema7) => {
  DataRecordSchemas.set(type, schema);
};

/**
 * get data record schema
 *
 * @param type - data record type
 *
 * @public
 */
export const getDataRecordSchema = <K extends keyof IDataRecordTypes>(type: K): JSONSchema7 | undefined => {
  return DataRecordSchemas.get(type);
};
