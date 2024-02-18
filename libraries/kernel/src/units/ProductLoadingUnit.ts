import { formatTime } from '@yuants/data-model';
import { IProduct, Terminal } from '@yuants/protocol';
import { defaultIfEmpty, lastValueFrom, map, tap } from 'rxjs';
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
  productTasks: { datasource_id: string; product_id: string }[] = [];

  async onInit() {
    this.kernel.log?.(
      formatTime(Date.now()),
      `start product loading: all ${this.productTasks.length} product(s)`,
    );
    for (const task of this.productTasks) {
      this.kernel.log?.(
        formatTime(Date.now()),
        `product loading: ${task.datasource_id} / ${task.product_id}`,
      );
      await lastValueFrom(
        this.terminal
          .queryDataRecords<IProduct>({
            type: 'product',
            tags: { datasource_id: task.datasource_id, product_id: task.product_id },
          })
          .pipe(
            map((x) => x.origin),
            defaultIfEmpty<IProduct, IProduct>({
              datasource_id: task.datasource_id,
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
