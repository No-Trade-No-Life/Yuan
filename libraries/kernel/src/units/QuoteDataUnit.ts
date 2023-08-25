import { BasicUnit } from './BasicUnit';

/**
 * 报价数据单元
 * @public
 */
export class QuoteDataUnit extends BasicUnit {
  mapProductIdToQuote: Record<string, { ask: number; bid: number }> = {};
}
