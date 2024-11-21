import { formatTime, IProduct } from '@yuants/data-model';
import { queryDataRecords, Terminal } from '@yuants/protocol';
import { defaultIfEmpty, defer, lastValueFrom, map, tap } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { ProductDataUnit } from './ProductDataUnit';

/**
 * Product Loading Unit: load product info from storage
 * @public
 */
export class ProductLoadingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public terminal: Terminal,
    public productDataUnit: ProductDataUnit,
    public options?: {},
  ) {
    super(kernel);
  }
  productTasks: { product_id: string }[] = [];

  async onInit() {
    this.kernel.log?.(
      formatTime(Date.now()),
      `start product loading: all ${this.productTasks.length} product(s)`,
    );
    for (const task of this.productTasks) {
      this.kernel.log?.(formatTime(Date.now()), `product loading: ${task.product_id}`);
      await lastValueFrom(
        defer(() =>
          queryDataRecords<IProduct>(this.terminal, {
            type: 'product',
            tags: { product_id: task.product_id },
          }),
        ).pipe(
          map((x) => x.origin),
          defaultIfEmpty<IProduct, IProduct>({
            product_id: task.product_id,
          }),
          tap((product) => {
            this.kernel.log?.(formatTime(Date.now()), 'product loaded', JSON.stringify(product));
            this.productDataUnit.updateProduct(product);
          }),
        ),
      );
    }
  }

  dump() {
    return {
      productTasks: this.productTasks,
    };
  }

  restore(state: any) {
    this.productTasks = state.productTasks;
  }
}
