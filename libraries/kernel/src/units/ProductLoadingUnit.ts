import { formatTime } from '@yuants/data-model';
import { IProduct, Terminal } from '@yuants/protocol';
import { defaultIfEmpty, filter, lastValueFrom, map, mergeMap, of, tap, throwIfEmpty, toArray } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { ProductDataUnit } from './ProductDataUnit';

// GSR
interface IGeneralSpecificRelation {
  // general_datasource_id 一定是 Y 常量，因此不需要特别存储
  // general_datasource_id: string;
  /** 标准品种ID */
  general_product_id: string; // XAUUSD
  /** 具体数据源 ID */
  specific_datasource_id: string; // TradingView
  /** 具体品种 ID */
  specific_product_id: string; // FX:XAUUSD
}

/**
 * 品种加载单元
 * @public
 */
export class ProductLoadingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public terminal: Terminal,
    public productDataUnit: ProductDataUnit,
    public options?: {
      use_general_product?: boolean;
    },
  ) {
    super(kernel);
  }
  productTasks: { datasource_id: string; product_id: string }[] = [];

  async onInit() {
    this.kernel.log?.(formatTime(Date.now()), `开始加载品种信息: 共 ${this.productTasks.length} 个品种`);
    for (const task of this.productTasks) {
      this.kernel.log?.(
        formatTime(Date.now()),
        `正在加载 ${task.datasource_id} / ${task.product_id} 的品种信息...`,
      );
      await lastValueFrom(
        this.terminal
          .queryDataRecords<IProduct>({
            type: 'product',
            tags: { datasource_id: task.datasource_id, product_id: task.product_id },
          })
          .pipe(
            // ISSUE: 有时候确实没有定义这个品种，技术指标观察器的场景中只需要行情数据，不强制需要品种信息
            // 在其他场景中，如果忘记配置品种信息，造成的潜在危害更大，因此用配置按需抑制此错误
            map((x) => x.origin),
            mergeMap((specificProduct) => {
              this.kernel.log?.(formatTime(Date.now()), `具体品种`, JSON.stringify(specificProduct));
              if (this.options?.use_general_product) {
                return this.terminal
                  .queryDataRecords<IGeneralSpecificRelation>({ type: 'general_specific_relation' })
                  .pipe(
                    map((x) => x.origin),
                    filter(
                      (x) =>
                        x.specific_datasource_id === task.datasource_id &&
                        x.specific_product_id === task.product_id,
                    ),
                    throwIfEmpty(
                      () => new Error(`无法找到 ${task.datasource_id} / ${task.product_id} 的标准品种关系`),
                    ),
                    map((x) => x.general_product_id),
                    tap((general_product_id) => {
                      this.kernel.log?.(formatTime(Date.now()), `匹配标准品种 "${general_product_id}"`);
                    }),
                  )
                  .pipe(
                    mergeMap((general_product_id) =>
                      this.terminal
                        .queryDataRecords<IProduct>({
                          type: 'product',
                          tags: { datasource_id: 'Y', product_id: general_product_id },
                        })
                        .pipe(
                          //
                          throwIfEmpty(() => new Error(`无法找到 ${general_product_id} 的标准品种`)),
                          map((x) => x.origin),
                          tap((generalProduct) => {
                            this.kernel.log?.(
                              formatTime(Date.now()),
                              `获取标准品种 "${generalProduct.product_id}"`,
                              JSON.stringify(generalProduct),
                            );
                          }),
                          map((generalProduct) => ({
                            ...generalProduct,
                            datasource_id: specificProduct.datasource_id,
                            product_id: specificProduct.product_id,
                          })),
                        ),
                    ),
                    // 此处代码是多余的，但是为了避免后续的代码出现问题，保留此处代码
                    throwIfEmpty(() => new Error(`无法找到标准品种`)),
                  );
              }
              return of(specificProduct);
            }),

            defaultIfEmpty<IProduct, IProduct>({
              datasource_id: task.datasource_id,
              product_id: task.product_id,
              base_currency: 'YYY',
              value_speed: 1,
              volume_step: 1e-8,
              price_step: 1e-8,
            }),
            tap((product) => {
              this.kernel.log?.(
                formatTime(Date.now()),
                `加载到 ${product.datasource_id}/${product.product_id} 品种`,
                JSON.stringify(product),
              );
              // Issue: 如果不推到 products 列表中可能会导致后续的性能审计遇到一些问题
              this.productDataUnit.mapProductIdToProduct[product.product_id] = product;
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
