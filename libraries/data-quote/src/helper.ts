import { Terminal } from '@yuants/protocol';
import { IQuoteKey } from './types';

/**
 * Query quotes from the VEX.
 *
 * 查询 VEX 中的报价数据。
 *
 * @param terminal - 终端实例。
 * @param product_ids - 关注的产品 ID 列表。
 * @param fields - 需要获取的字段列表（IQuote 的键）。
 * @param updated_at - (SWR) 在此时间戳之后更新的报价数据会被更新，但此次请求仍会返回可能未更新的数据。
 *
 * 无论 updated_at 设置为何值，都会立即返回 VEX 中目前缓存的数据，使用 SWR 策略在后台更新数据。
 *
 * 有三种典型的用法：
 * 1. updated_at = 0: 不会更新任何数据。
 * 2. updated_at = Date.now(): 强制更新所有数据。
 * 3. updated_at = Date.now() - X: 仅更新在过去 X 毫秒内未更新过的数据。
 *
 * 鼓励批量查询，以减少请求次数和网络开销。
 *
 * @public
 */
export const queryQuotes = async <K extends IQuoteKey>(
  terminal: Terminal,
  product_ids: string[],
  fields: K[],
  updated_at: number,
): Promise<Record<string, Record<K, string>>> => {
  return terminal.client.requestForResponseData<{}, Record<string, Record<K, string>>>('VEX/QueryQuotes', {
    product_ids,
    fields,
    updated_at,
  });
};
