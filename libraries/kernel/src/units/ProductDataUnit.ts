import { IProduct } from '@yuants/protocol';
import { BasicUnit } from './BasicUnit';

/**
 * 品种数据单元
 * @public
 */
export class ProductDataUnit extends BasicUnit {
  mapProductIdToProduct: Record<string, IProduct> = {};

  dump() {
    return {
      mapProductIdToProduct: this.mapProductIdToProduct,
    };
  }
  restore(state: any): void {
    this.mapProductIdToProduct = state.mapProductIdToProduct;
  }
}
