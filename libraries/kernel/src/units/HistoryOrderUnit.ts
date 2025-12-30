import { IOrder } from '@yuants/data-order';
import { Subject } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { QuoteDataUnit } from './QuoteDataUnit';

/**
 * 历史订单单元
 * @public
 */
export class HistoryOrderUnit extends BasicUnit {
  constructor(public kernel: Kernel, public quoteDataUnit: QuoteDataUnit) {
    super(kernel);
  }

  private _orderUpdated$ = new Subject<IOrder>();
  /** 订单更新事件 */
  orderUpdated$ = this._orderUpdated$.asObservable();

  /** 历史订单列表 */
  historyOrders: IOrder[] = [];
  /** 更新订单 */
  updateOrder(order: IOrder) {
    this.historyOrders.push(order);

    // 抄送报价
    // ISSUE: 仅账户回放场景下需要抄送
    // if (order.traded_volume) {
    //   const theProduct = this.productDataUnit.mapProductIdToProduct[order.product_id]!;
    //   const spread = theProduct.spread ?? 0;
    //   if (order.direction === OrderDirection.OPEN_LONG || order.direction === OrderDirection.CLOSE_SHORT) {
    //     this.quoteDataUnit.mapProductIdToQuote[order.product_id] = {
    //       ask: order.traded_price!,
    //       bid: order.traded_price! - spread
    //     };
    //   } else {
    //     this.quoteDataUnit.mapProductIdToQuote[order.product_id] = {
    //       ask: order.traded_price! + spread,
    //       bid: order.traded_price!
    //     };
    //   }
    // }

    this._orderUpdated$.next(order);
  }

  dump() {
    return {
      historyOrders: this.historyOrders,
    };
  }
  restore(state: any) {
    this.historyOrders = state.historyOrders;
  }
}
