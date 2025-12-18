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
const mapFieldNameToOffset = Object.fromEntries(FIELDS.map((field, index) => [field, index * 2]));

/**
 * 高效的行情状态管理器
 * 内部使用扁平化数组存储数据，避免内存碎片化和过多的 Map/对象开销
 * 提供高效的读写接口，支持按需更新和查询
 */
export const createQuoteStateV1 = (): IQuoteState => {
  // 内部数据结构的设计需要考虑高效的读写性能，防止内存碎片化
  const data: (string | number)[] = [];
  const products: string[] = [];
  const mapProductIdToIndex = new Map<string, number>();
  // 0~20 (10 fields * 2 (value, updated_at))
  const getFieldOffset = (product_id: string, field: string): number | undefined => {
    let baseIndex = mapProductIdToIndex.get(product_id);
    if (baseIndex === undefined) {
      return undefined;
    }
    const fieldOffset = mapFieldNameToOffset[field];
    if (fieldOffset === undefined) throw newError('INVALID_FIELD_NAME', { field, available_fields: FIELDS });
    return baseIndex + fieldOffset;
  };

  const getValueTuple = (product_id: string, field: IQuoteKey): [string, number] | undefined => {
    const offset = getFieldOffset(product_id, field);
    if (offset === undefined) return undefined;
    const value = data[offset] as string;
    if (value === undefined) return undefined;
    const updated_at = data[offset + 1] as number;
    return [value, updated_at];
  };

  const setValueTuple = (product_id: string, field: IQuoteKey, value: string, updated_at: number) => {
    let offset = getFieldOffset(product_id, field);
    if (offset === undefined) {
      const baseIndex = mapProductIdToIndex.size * FIELD_COUNT * 2;
      products.push(product_id);
      mapProductIdToIndex.set(product_id, baseIndex);
      offset = baseIndex + mapFieldNameToOffset[field];
    }
    data[offset] = value;
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
    for (const product_id of products) {
      result[product_id] = {};
    }
    for (let i = 0; i < data.length; i += 2) {
      const value = data[i] as string;
      if (value === undefined) continue;
      const updated_at = data[i + 1] as number;

      const productIndex = Math.floor(i / (FIELD_COUNT * 2));
      const product_id = products[productIndex];

      const fieldIndex = (i % (FIELD_COUNT * 2)) / 2;
      const field_name = FIELDS[fieldIndex];

      result[product_id][field_name] = [value, updated_at];
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
      result[product_id] = {};
      for (const field of fields) {
        const tuple = getValueTuple(product_id, field);
        if (tuple && tuple[1] >= updated_at) {
          result[product_id]![field] = tuple;
        }
      }
    }
    return result;
  };

  const filterValues = <K extends IQuoteKey>(
    product_ids: string[],
    fields: K[],
  ): Record<string, Record<K, string>> => {
    const result: Record<string, Record<K, string>> = {};
    for (const product_id of product_ids) {
      result[product_id] = {} as Record<K, string>;
      for (const field of fields) {
        const tuple = getValueTuple(product_id, field);
        result[product_id][field] = tuple ? tuple[0] : '';
      }
    }
    return result;
  };

  return { update, dumpAsObject, getValueTuple, filter, filterValues };
};
