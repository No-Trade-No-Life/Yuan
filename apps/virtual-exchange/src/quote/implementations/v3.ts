import { newError } from '@yuants/utils';
import { IQuoteKey, IQuoteState, IQuoteUpdateAction } from '../types';

// TRICK: 固定字段顺序，方便计算偏移量
const FIELDS = ((x: { [key in IQuoteKey]: number }) => Object.keys(x).sort() as IQuoteKey[])({
  // TS TRICK: 强制运行时数组具有 IQuoteKey 的所有字段。不重不漏，味道真是好极了
  last_price: 0,
  ask_price: 0,
  ask_volume: 0,
  bid_volume: 0,
  bid_price: 0,
  interest_rate_short: 0,
  open_interest: 0,
  interest_rate_prev_settled_at: 0,
  interest_rate_next_settled_at: 0,
  interest_rate_long: 0,
});

const FIELD_COUNT = FIELDS.length;
const mapFieldNameToOffset = Object.fromEntries(FIELDS.map((field, index) => [field, index * 2])); // 每个字段占2个位置: [池索引, 时间戳]

/**
 * 使用引用计数字符串池的行情状态管理器 v3
 * 保持 v1 的内存局部性，同时通过字符串池减少内存开销
 * 使用 Float64Array 连续存储 [池索引, 时间戳] 对
 */
export const createQuoteStateV3 = (): IQuoteState => {
  // 核心数据存储：连续存储 [池索引, 时间戳, 池索引, 时间戳...]
  let data: Float64Array = new Float64Array(1024 * FIELD_COUNT * 2); // 初始容量：1024产品
  let dataLength = 0; // 当前已分配的数据槽数量（以字段为单位）

  // 字符串池
  let stringPool: (string | undefined)[] = []; // 索引 -> 字符串（undefined 表示空闲）
  let refCounts: number[] = []; // 索引 -> 引用计数
  let stringToIndex = new Map<string, number>(); // 字符串 -> 索引
  let freeIndices: number[] = []; // 空闲索引列表

  const products: string[] = [];
  const mapProductIdToIndex = new Map<string, number>();

  // 确保 data 有足够容量
  const ensureDataCapacity = (requiredFields: number) => {
    if (requiredFields * 2 <= data.length) return;

    // 倍增扩容
    const newSize = Math.max(data.length * 2, requiredFields * 2 + 1024);
    const newData = new Float64Array(newSize);
    newData.set(data);
    data = newData;
  };

  // 获取字段偏移量（以 Float64 元素为单位）
  const getFieldOffset = (product_id: string, field: string): number => {
    let baseIndex = mapProductIdToIndex.get(product_id);
    if (baseIndex === undefined) {
      baseIndex = mapProductIdToIndex.size;
      products.push(product_id);
      mapProductIdToIndex.set(product_id, baseIndex);

      // 确保有足够空间存储该产品的所有字段
      const requiredFields = (baseIndex + 1) * FIELD_COUNT;
      ensureDataCapacity(requiredFields);

      // 初始化该产品的所有字段为 [-1, 0]（空值）
      const startIdx = baseIndex * FIELD_COUNT * 2;
      for (let i = 0; i < FIELD_COUNT * 2; i += 2) {
        data[startIdx + i] = -1; // 池索引：-1 表示空值
        data[startIdx + i + 1] = 0; // 时间戳：0
      }
      dataLength = Math.max(dataLength, requiredFields);
    }
    const fieldOffset = mapFieldNameToOffset[field];
    if (fieldOffset === undefined) throw newError('INVALID_FIELD_NAME', { field, available_fields: FIELDS });
    return baseIndex * FIELD_COUNT * 2 + fieldOffset;
  };

  // 获取或分配字符串索引（增加引用计数）
  const acquireStringIndex = (value: string): number => {
    let index = stringToIndex.get(value);
    if (index !== undefined) {
      // 字符串已存在，增加引用计数
      refCounts[index]++;
      return index;
    }

    // 需要新索引
    if (freeIndices.length > 0) {
      // 重用空闲索引
      index = freeIndices.pop()!;
      stringPool[index] = value;
      refCounts[index] = 1;
    } else {
      // 分配新索引
      index = stringPool.length;
      stringPool.push(value);
      refCounts.push(1);
    }

    stringToIndex.set(value, index);
    return index;
  };

  // 释放字符串索引（减少引用计数）
  const releaseStringIndex = (index: number): void => {
    if (index === -1) return; // 空值索引

    refCounts[index]--;
    if (refCounts[index] === 0) {
      // 引用计数归零，可以回收
      const value = stringPool[index]!;
      stringToIndex.delete(value);
      // 清空池中的引用，允许 GC
      stringPool[index] = undefined;
      refCounts[index] = 0;
      freeIndices.push(index);
    }
  };

  const getValueTuple = (product_id: string, field: IQuoteKey): [string, number] | undefined => {
    const offset = getFieldOffset(product_id, field);
    const poolIndex = data[offset];
    if (poolIndex === -1) return undefined;

    const timestamp = data[offset + 1];
    const value = stringPool[poolIndex]!;
    return [value, timestamp];
  };

  const setValueTuple = (product_id: string, field: IQuoteKey, value: string, updated_at: number) => {
    const offset = getFieldOffset(product_id, field);
    const oldPoolIndex = data[offset];

    // 释放旧字符串的引用
    releaseStringIndex(oldPoolIndex);

    // 获取新字符串索引
    const newPoolIndex = acquireStringIndex(value);

    // 更新存储
    data[offset] = newPoolIndex;
    data[offset + 1] = updated_at;
  };

  const update = (action: IQuoteUpdateAction) => {
    for (const product_id in action) {
      const fields = action[product_id];
      for (const field_name in fields) {
        const field = field_name as IQuoteKey;
        const [value, updated_at] = fields[field]!;
        const oldTuple = getValueTuple(product_id, field);
        if (oldTuple === undefined || updated_at >= oldTuple[1]) {
          setValueTuple(product_id, field, value, updated_at);
        }
      }
    }
  };

  const dumpAsObject = (): IQuoteUpdateAction => {
    const result: IQuoteUpdateAction = {};

    // 初始化所有产品的结构
    for (const product_id of products) {
      result[product_id] = {};
    }

    // 遍历所有字段（dataLength 是以字段为单位）
    for (let fieldIdx = 0; fieldIdx < dataLength; fieldIdx++) {
      const poolIndex = data[fieldIdx * 2];
      if (poolIndex === -1) continue; // 空值

      const timestamp = data[fieldIdx * 2 + 1];
      const productIndex = Math.floor(fieldIdx / FIELD_COUNT);
      const product_id = products[productIndex];

      const fieldIndex = fieldIdx % FIELD_COUNT;
      const field_name = FIELDS[fieldIndex];

      const value = stringPool[poolIndex]!;
      result[product_id]![field_name] = [value, timestamp];
    }

    return result;
  };

  /**
   * 过滤状态，返回指定 product_id 列表和字段列表中，且更新时间不早于指定时间的字段数据
   * @param product_ids - 需要过滤的 product_id 列表
   * @param fields - 需要过滤的字段列表
   * @param updated_at - 需要过滤的更新时间阈值 (仅返回更新时间不早于该值的字段)
   * @returns 过滤后的数据
   */
  const filter = (product_ids: string[], fields: IQuoteKey[], updated_at: number): IQuoteUpdateAction => {
    const result: IQuoteUpdateAction = {};

    for (const product_id of product_ids) {
      const productIndex = mapProductIdToIndex.get(product_id);
      if (productIndex === undefined) {
        // 产品不存在，创建空对象
        result[product_id] = {};
        continue;
      }

      const productResult: Partial<Record<IQuoteKey, [string, number]>> = {};
      const baseOffset = productIndex * FIELD_COUNT * 2;

      for (const field of fields) {
        const fieldOffset = mapFieldNameToOffset[field];
        if (fieldOffset === undefined) continue;

        const offset = baseOffset + fieldOffset;
        const poolIndex = data[offset];
        if (poolIndex === -1) continue; // 空值

        const timestamp = data[offset + 1];
        if (timestamp < updated_at) continue; // 时间戳太旧

        const value = stringPool[poolIndex]!;
        productResult[field] = [value, timestamp];
      }

      result[product_id] = productResult;
    }

    return result;
  };

  // 导出内部统计信息用于调试
  const getStats = () => ({
    productCount: products.length,
    fieldCount: dataLength,
    stringPoolSize: stringPool.length,
    activeStrings: stringPool.length - freeIndices.length,
    freeIndices: freeIndices.length,
    memoryEstimate: {
      data: data.length * 8, // Float64Array 每个元素8字节
      pool: stringPool.reduce((sum, str) => sum + (str ? str.length * 2 : 0), 0),
      structures: products.length * 50 + stringPool.length * 16, // 粗略估计
    },
  });

  return { update, dumpAsObject, getValueTuple, filter };
};
