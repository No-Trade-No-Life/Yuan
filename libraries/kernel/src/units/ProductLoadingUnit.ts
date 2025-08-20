import { IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { defaultIfEmpty, defer, lastValueFrom, mergeAll, tap } from 'rxjs';
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
        defer(() =>
          requestSQL<IProduct[]>(
            this.terminal,
            `SELECT * FROM product WHERE datasource_id = ${escapeSQL(
              task.datasource_id,
            )} AND product_id = ${escapeSQL(task.product_id)}`,
          ),
        ).pipe(
          mergeAll(),
          defaultIfEmpty<IProduct, IProduct>({
            datasource_id: task.datasource_id,
            product_id: task.product_id,
            name: '',
            quote_currency: '',
            base_currency: '',
            price_step: 1,
            volume_step: 1,
            value_scale: 1,
            value_scale_unit: '',
            margin_rate: 1,
            value_based_cost: 0,
            volume_based_cost: 0,
            max_position: 0,
            max_volume: 0,
            allow_long: true,
            allow_short: true,
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
