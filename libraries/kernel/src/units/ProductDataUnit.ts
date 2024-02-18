import { IProduct } from '@yuants/protocol';
import { AccountDatasourceRelationUnit } from './AccountDatasouceRelationUnit';
import { BasicUnit } from './BasicUnit';

/**
 * 品种数据单元
 * @public
 */
export class ProductDataUnit extends BasicUnit {
  private mapProductIdToProduct: Record<string, Record<string, IProduct>> = {};
  private adrUnit: AccountDatasourceRelationUnit | undefined;

  onInit(): void | Promise<void> {
    this.adrUnit = this.kernel.findUnit(AccountDatasourceRelationUnit);
  }

  listProducts(): IProduct[] {
    return Object.values(this.mapProductIdToProduct).flatMap((x) => Object.values(x));
  }

  getProduct(datasource_id: string, product_id: string): IProduct | undefined {
    return (
      this.mapProductIdToProduct[datasource_id]?.[product_id] ?? this.mapProductIdToProduct['']?.[product_id]
    );
  }

  updateProduct(product: IProduct) {
    // Set default
    (this.mapProductIdToProduct[''] ??= {})[product.product_id] = product;
    // Set datasource_id
    (this.mapProductIdToProduct[product.datasource_id] ??= {})[product.product_id] = product;
    // Copy to All Related Accounts
    if (this.adrUnit) {
      for (const relation of this.adrUnit.list()) {
        if (relation.datasource_id === product.datasource_id && relation.product_id === product.product_id) {
          (this.mapProductIdToProduct[relation.account_id] ??= {})[product.product_id] = product;
        }
      }
    }
  }

  dump() {
    return {
      mapProductIdToProduct: this.mapProductIdToProduct,
    };
  }
  restore(state: any): void {
    this.mapProductIdToProduct = state.mapProductIdToProduct;
  }
}
