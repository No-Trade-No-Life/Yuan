import { IOHLC } from '@yuants/data-ohlc';
import { IQuote } from '@yuants/data-quote';
import { IOrder } from '@yuants/data-order';
import { encodePath, roundToStep } from '@yuants/utils';
import { Subject, takeUntil } from 'rxjs';
import { Kernel } from '../kernel';
import { AccountInfoUnit } from './AccountInfoUnit';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { PeriodDataUnit } from './PeriodDataUnit';
import { QuoteDataUnit } from './QuoteDataUnit';
import { TickDataUnit } from './TickDataUnit';

/**
 *
 * @public
 */
export interface IMatchingRange {
  first: number;
  high: number;
  low: number;
  last: number;
}

/**
 * 委托订单撮合单元
 * @public
 */
export class OrderMatchingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public periodDataUnit: PeriodDataUnit,
    public tickDataUnit: TickDataUnit,
    public accountInfoUnit: AccountInfoUnit,
    public historyOrderUnit: HistoryOrderUnit,
    public quoteDataUnit: QuoteDataUnit,
  ) {
    super(kernel);
  }

  private _orderSubmitted$ = new Subject<IOrder[]>();
  private _orderCancelled$ = new Subject<string[]>();

  /** Order Submit Event */
  orderSubmitted$ = this._orderSubmitted$.asObservable();
  /** Order Cancel Event */
  orderCancelled$ = this._orderCancelled$.asObservable();

  onInit(): void | Promise<void> {
    this.periodDataUnit.periodUpdated$
      .pipe(takeUntil(this.kernel.dispose$))
      .subscribe((period) => this.updateRangeByPeriod(period));
    this.tickDataUnit.tickUpdated$
      .pipe(takeUntil(this.kernel.dispose$))
      .subscribe((tick) => this.updateRangeByTick(tick));
  }

  onEvent(): void | Promise<void> {
    this.doMatching();
  }

  private prevPeriodMap: Record<string, IOHLC> = {};

  private updateRangeByPeriod(period: IOHLC): void {
    const product_id = period.product_id;
    const prevPeriod = this.prevPeriodMap[period.series_id];
    if (prevPeriod && new Date(prevPeriod.created_at).getTime() === new Date(period.created_at).getTime()) {
      // 同一K线，使用连续性的保守推断
      const first = +prevPeriod.close;
      const high = Math.max(
        +prevPeriod.close,
        +period.close,
        +period.high > +prevPeriod.high ? +period.high : -Infinity,
      );
      const low = Math.min(
        +prevPeriod.close,
        +period.close,
        +period.low < +prevPeriod.low ? +period.low : Infinity,
      );
      for (const accountId of this.accountInfoUnit.mapAccountIdToAccountInfo.keys()) {
        this.mapProductIdToRange.set(encodePath(accountId, product_id), {
          ask: {
            first: first,
            high: high,
            low: low,
            last: first,
          },
          bid: {
            first,
            high,
            low,
            last: first,
          },
        });
      }
    } else {
      // New Period
      for (const accountId of this.accountInfoUnit.mapAccountIdToAccountInfo.keys()) {
        this.mapProductIdToRange.set(encodePath(accountId, product_id), {
          ask: {
            first: +period.open,
            high: +period.high,
            low: +period.low,
            last: +period.close,
          },
          bid: {
            first: +period.open,
            high: +period.high,
            low: +period.low,
            last: +period.close,
          },
        });
      }
    }
    this.prevPeriodMap[period.series_id] = period;
  }

  private updateRangeByTick(tick: IQuote): void {
    const ask = +tick.ask_price;
    const bid = +tick.bid_price;
    if (!ask || !bid) return;
    this.mapProductIdToRange.set(encodePath(tick.datasource_id, tick.product_id), {
      ask: {
        first: ask,
        high: ask,
        low: ask,
        last: ask,
      },
      bid: {
        first: bid,
        high: bid,
        low: bid,
        last: bid,
      },
    });
  }
  /**
   * 待成交订单
   */
  private mapOrderIdToOrder = new Map<string, IOrder>();
  /**
   * 撮合品种的可撮合价格范围
   */
  private mapProductIdToRange = new Map<string, { ask: IMatchingRange; bid: IMatchingRange }>();

  submitOrder(...orders: IOrder[]) {
    for (const order of orders) {
      order.submit_at = this.kernel.currentTimestamp;
      this.mapOrderIdToOrder.set(order.order_id!, order);
    }
    this._orderSubmitted$.next(orders);
  }

  getOrderById(id: string) {
    return this.mapOrderIdToOrder.get(id);
  }

  listOrders(): IOrder[] {
    return Array.from(this.mapOrderIdToOrder.values());
  }

  cancelOrder(...orderIds: string[]) {
    for (const id of orderIds) {
      this.mapOrderIdToOrder.delete(id);
    }
    this._orderCancelled$.next(orderIds);
  }

  private checkTradedPriceForRange = (order: IOrder): number => {
    const range = this.mapProductIdToRange.get(encodePath(order.account_id, order.product_id));
    if (!range) return NaN;
    if (order.order_type === 'MARKET') {
      if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT') {
        // 开多/平空
        return range.ask.first;
      } else {
        // 开空/平多
        return range.bid.first;
      }
    }
    if (order.order_type === 'LIMIT') {
      if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT') {
        // 开多/平空
        if (order.price! > range.ask.first) return range.ask.first;
        if (order.price! > range.ask.low) return order.price!;
      } else {
        // 开空/平多
        if (order.price! < range.bid.first) return range.bid.first;
        if (order.price! < range.bid.high) return order.price!;
      }
    }
    if (order.order_type === 'STOP') {
      if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT') {
        // 开多/平空
        if (order.price! < range.ask.first) return range.ask.first;
        if (order.price! < range.ask.high) return order.price!;
      } else {
        // 开空/平多
        if (order.price! > range.bid.first) return range.bid.first;
        if (order.price! > range.bid.low) return order.price!;
      }
    }
    return NaN;
  };

  private doMatching() {
    let isSomeOrderTraded = false;
    for (const order of this.mapOrderIdToOrder.values()) {
      const tradedPrice = this.checkTradedPriceForRange(order);
      if (Number.isNaN(tradedPrice)) {
        continue;
      }
      isSomeOrderTraded = true;
      const volume = roundToStep(order.volume, 1);
      const theOrder: IOrder = {
        ...order,
        filled_at: this.kernel.currentTimestamp,
        traded_price: tradedPrice,
        volume,
        traded_volume: volume,
        traded_value: tradedPrice * volume,
      };
      // 成交
      this.kernel.log?.(
        '撮合成交',
        theOrder.product_id,
        theOrder.order_direction,
        `成交价=${theOrder.traded_price}`,
        `成交量=${theOrder.traded_volume}`,
        `订单ID='${theOrder.order_id}'`,
        `头寸ID='${theOrder.position_id}'`,
        `账户ID='${theOrder.account_id}'`,
        `订单类型='${theOrder.order_type}'`,
        `撮合行情=${JSON.stringify(
          this.mapProductIdToRange.get(encodePath(theOrder.account_id, theOrder.product_id)),
        )}`,
      );
      this.mapOrderIdToOrder.delete(order.order_id!);
      this.historyOrderUnit.updateOrder(theOrder);
    }
    // 撮合完成后，将所有的 range 置为 last
    for (const [key, range] of this.mapProductIdToRange.entries()) {
      range.ask.first = range.ask.high = range.ask.low = range.ask.last;
      range.bid.first = range.bid.high = range.bid.low = range.bid.last;
    }
    if (isSomeOrderTraded) {
      // 撮合成功后，申请一次重计算更新上游单元状态
      const id = this.kernel.alloc(this.kernel.currentTimestamp);
      this.kernel.log?.('撮合成功，申请重计算', id);
    }
  }

  dump() {
    return {
      mapOrderIdToOrder: this.mapOrderIdToOrder,
      mapProductIdToRange: this.mapProductIdToRange,
      prevPeriodMap: this.prevPeriodMap,
    };
  }

  restore(state: any) {
    this.mapOrderIdToOrder = state.mapOrderIdToOrder;
    this.mapProductIdToRange = state.mapProductIdToRange;
    this.prevPeriodMap = state.prevPeriodMap;
  }
}
