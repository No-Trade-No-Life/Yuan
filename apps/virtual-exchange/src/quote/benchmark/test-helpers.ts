import { IQuoteKey, IQuoteUpdateAction } from '../types';

/**
 * 生成随机字符串
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机产品ID
 */
export function generateProductId(index: number): string {
  return `product_${index.toString().padStart(10, '0')}`;
}

/**
 * 获取所有字段列表
 */
export function getAllFields(): IQuoteKey[] {
  // 从 state.ts 中的 FIELDS 数组获取
  return [
    'last_price',
    'ask_price',
    'ask_volume',
    'bid_volume',
    'bid_price',
    'interest_rate_short',
    'open_interest',
    'interest_rate_prev_settled_at',
    'interest_rate_next_settled_at',
    'interest_rate_long',
  ];
}

/**
 * 生成测试数据
 */
export function generateTestData(productCount: number, fields: IQuoteKey[]): IQuoteUpdateAction {
  const data: IQuoteUpdateAction = {};
  const now = Date.now();

  for (let i = 0; i < productCount; i++) {
    const productId = generateProductId(i);
    data[productId] = {};

    // 为每个字段生成随机值
    for (const field of fields) {
      // 生成合适的随机值
      let value: string;
      if (field.includes('price') || field.includes('rate')) {
        value = (Math.random() * 1000).toFixed(4);
      } else if (field.includes('volume') || field.includes('interest')) {
        value = Math.floor(Math.random() * 10000).toString();
      } else if (field.includes('settled_at')) {
        value = (now + Math.random() * 1000000).toFixed(0);
      } else {
        value = randomString(10);
      }

      data[productId]![field] = [value, now];
    }
  }

  return data;
}
