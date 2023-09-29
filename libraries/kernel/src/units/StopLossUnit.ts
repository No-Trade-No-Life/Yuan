import { UUID } from '@yuants/data-model';
import { IOrder, OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { getClosePriceByDesiredProfit, mergePositions } from '../utils';
import { AccountPerformanceUnit } from './AccountPerformanceUnit';
import { AccountSimulatorUnit } from './AccountSimulatorUnit';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { OrderMatchingUnit } from './OrderMatchingUnit';
import { ProductDataUnit } from './ProductDataUnit';
import { QuoteDataUnit } from './QuoteDataUnit';

/**
 * 止损单元
 *
 * @public
 */
export class StopLossOrderMapperUnit extends BasicUnit {
  // TODO: 通过一组配置止损
  constructor(
    public kernel: Kernel,
    public account_id: string,
    public resumeOnSourceMarginBelow: number,
    public productDataUnit: ProductDataUnit,
    public quoteDataUnit: QuoteDataUnit,
    public sourceAccountSimulatorUnit: AccountSimulatorUnit,
    public sourceAccountPerformanceUnit: AccountPerformanceUnit,
    public sourceHistoryOrderUnit: HistoryOrderUnit,
    // NOTE: 绑定了 targetHistoryOrderUnit 的 OrderMatchingUnit
    public targetOrderMatchingUnit: OrderMatchingUnit,
    public targetHistoryOrderUnit: HistoryOrderUnit,
  ) {
    super(kernel);
  }

  // 是否处于止损状态
  in_stop_loss_state: boolean = false;
  private stopLossOrderIds = new Set<string>();

  private last_max_maintenance_margin: number = 0;
  private subscriptions: Subscription[] = [];

  onInit(): void | Promise<void> {
    this.subscriptions.push(
      this.sourceHistoryOrderUnit.orderUpdated$.subscribe((order) => this.onSourceOrderUpdated(order)),
    );

    this.subscriptions.push(
      this.targetHistoryOrderUnit.orderUpdated$.subscribe((order) => this.onTargetOrderUpdated(order)),
    );
  }

  private onTargetOrderUpdated(order: IOrder): void {
    if (!this.in_stop_loss_state) {
      if (this.stopLossOrderIds.has(order.client_order_id)) {
        this.in_stop_loss_state = true;
        this.kernel.log?.(`止损状态开始: 发现止损单已经成交: ${order.client_order_id}`);
      }
    }
  }

  private onSourceOrderUpdated(order: IOrder): void {
    if (!this.in_stop_loss_state) {
      // 正常跟单
      // 因为还没有止损，所以将所有订单都复制到目标订单单元
      this.targetHistoryOrderUnit.updateOrder({ ...order, account_id: this.account_id });
      // // NOTE: 可能需要通过 OrderMatchingUnit 来进行撮合
      // this.targetOrderMatchingUnit.submitOrder({ ...order, account_id: this.account_id });
    }
  }

  onDispose(): void | Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  onEvent(): void {
    if (this.in_stop_loss_state) {
      // 市价平掉剩余仓位
      // ISSUE: 取消订单之后重新下单以立即促成成交

      const ordersRemains = Array.from(this.stopLossOrderIds)
        .map((client_order_id) => this.targetOrderMatchingUnit.getOrderById(client_order_id))
        .filter((order): order is Exclude<typeof order, undefined> => !!order);
      for (let order of ordersRemains) {
        order.type = OrderType.MARKET;
      }

      // 处于止损状态，检测是否可以恢复跟单
      if (this.sourceAccountSimulatorUnit.accountInfo.money.used < this.resumeOnSourceMarginBelow) {
        // 达到重新开仓条件
        const mergedPositions = mergePositions(this.sourceAccountSimulatorUnit.accountInfo.positions);
        for (const position of mergedPositions) {
          const order: IOrder = {
            client_order_id: UUID(),
            account_id: this.account_id,
            product_id: position.product_id,
            position_id: position.position_id,
            type: OrderType.MARKET,
            direction:
              position.variant === PositionVariant.LONG
                ? OrderDirection.OPEN_LONG
                : OrderDirection.OPEN_SHORT,
            volume: position.volume,
          };
          this.targetOrderMatchingUnit.submitOrder(order);
        }
        this.in_stop_loss_state = false;
        this.last_max_maintenance_margin =
          this.sourceAccountPerformanceUnit.performance.max_maintenance_margin;
        this.kernel.log?.(
          `止损状态结束: 恢复跟单 ${this.sourceAccountSimulatorUnit.accountInfo.money.used} < ${this.resumeOnSourceMarginBelow}`,
        );
      }
      // 否则维持止损状态，不做任何操作
    } else {
      // 未触发止损
      // 计算止损线
      const drawdown_quota =
        this.last_max_maintenance_margin - this.sourceAccountPerformanceUnit.performance.maintenance_margin;
      // 维护 STOP 单，全部重新挂单
      this.targetOrderMatchingUnit.cancelOrder(...this.stopLossOrderIds);
      this.stopLossOrderIds.clear();
      const mapProductIdVariantToClosePrice: Record<string, number> = {};
      const mergedPositions = mergePositions(this.sourceAccountSimulatorUnit.accountInfo.positions);
      for (const position of mergedPositions) {
        const theProduct = this.productDataUnit.mapProductIdToProduct[position.product_id];
        const price = getClosePriceByDesiredProfit(
          theProduct,
          position.position_price,
          position.volume,
          -(drawdown_quota - position.floating_profit),
          position.variant,
          this.sourceAccountSimulatorUnit.accountInfo.money.currency,
          (product_id) => this.quoteDataUnit.mapProductIdToQuote[product_id],
        );
        mapProductIdVariantToClosePrice[`${position.product_id}${position.variant}`] = price;
      }
      // ISSUE: 需要按照计算好的平仓价格分别平掉每一个头寸
      for (const position of this.sourceAccountSimulatorUnit.accountInfo.positions) {
        const closePrice = mapProductIdVariantToClosePrice[`${position.product_id}${position.variant}`];
        if (Number.isNaN(closePrice)) {
          continue;
        }
        const order: IOrder = {
          client_order_id: UUID(),
          account_id: this.account_id,
          product_id: position.product_id,
          position_id: position.position_id,
          type: OrderType.STOP,
          direction:
            position.variant === PositionVariant.LONG
              ? OrderDirection.CLOSE_LONG
              : OrderDirection.CLOSE_SHORT,
          volume: position.volume,
          price: closePrice,
        };
        this.stopLossOrderIds.add(order.client_order_id);
        this.targetOrderMatchingUnit.submitOrder(order);
      }
    }
  }
}
