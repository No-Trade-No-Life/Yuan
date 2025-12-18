import { IQuoteKey, IQuoteState, IQuoteUpdateAction } from '../types';

/**
 * 创建一个简单的基于 Map 的实现，用于对比测试
 * 这个实现使用嵌套 Map 结构，作为性能对比的基准
 */
export function createQuoteStateV0(): IQuoteState {
  // 使用三层嵌套结构：product_id -> field -> [value, updated_at]
  const data = new Map<string, Map<IQuoteKey, [string, number]>>();

  const update = (action: IQuoteUpdateAction) => {
    for (const product_id in action) {
      let productMap = data.get(product_id);
      if (!productMap) {
        productMap = new Map();
        data.set(product_id, productMap);
      }

      const fields = action[product_id];
      for (const field_name in fields) {
        const field = field_name as IQuoteKey;
        const [value, updated_at] = fields[field]!;
        const existing = productMap.get(field);
        if (!existing || updated_at >= existing[1]) {
          productMap.set(field, [value, updated_at]);
        }
      }
    }
  };

  const dumpAsObject = (): IQuoteUpdateAction => {
    const result: IQuoteUpdateAction = {};
    data.forEach((productMap, product_id) => {
      const productData: Partial<Record<IQuoteKey, [string, number]>> = {};
      productMap.forEach((tuple, field) => {
        productData[field] = tuple;
      });
      result[product_id] = productData;
    });
    return result;
  };

  const getValueTuple = (product_id: string, field: IQuoteKey): [string, number] | undefined => {
    const productMap = data.get(product_id);
    if (!productMap) return undefined;
    return productMap.get(field);
  };

  const filter = (product_ids: string[], fields: IQuoteKey[], updated_at: number): IQuoteUpdateAction => {
    const result: IQuoteUpdateAction = {};
    for (const product_id of product_ids) {
      const productMap = data.get(product_id);
      const productData: Partial<Record<IQuoteKey, [string, number]>> = {};

      if (productMap) {
        for (const field of fields) {
          const tuple = productMap.get(field);
          if (tuple && tuple[1] >= updated_at) {
            productData[field] = tuple;
          }
        }
      }

      result[product_id] = productData;
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
}
