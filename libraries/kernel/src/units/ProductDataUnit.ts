import { IProduct } from '@yuants/protocol';
import { BasicUnit } from './BasicUnit';

/**
 * 品种数据单元
 * @public
 */
export class ProductDataUnit extends BasicUnit {
  mapProductIdToProduct: Record<string, IProduct> = {};
}
