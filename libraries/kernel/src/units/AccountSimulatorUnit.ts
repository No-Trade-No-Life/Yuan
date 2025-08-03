import { IAccountInfo, IAccountMoney, IPosition } from '@yuants/data-account';
import { roundToStep } from '@yuants/utils';
import { Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { getMargin, getProfit } from '../utils';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { ProductDataUnit } from './ProductDataUnit';
import { QuoteDataUnit } from './QuoteDataUnit';

/**
 * 账户模拟单元
 * @deprecated - use AccountInfoUnit instead
 * @public
 */
export class AccountSimulatorUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public productDataUnit: ProductDataUnit,
    public quoteDataUnit: QuoteDataUnit,
    public historyOrderUnit: HistoryOrderUnit,
    public accountInfo: IAccountInfo,
  ) {
    super(kernel);
  }

  private subscriptions: Subscription[] = [];

  onInit(): void | Promise<void> {
    this.subscriptions.push(this.historyOrderUnit.orderUpdated$.subscribe(() => this.onEvent()));
  }
  onDispose(): void | Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  private mapPositionIdToPosition: Record<string, IPosition> = {};

  private orderIdx = 0;

  getPosition(position_id: string, product_id: string, direction: string): IPosition {
    return (this.mapPositionIdToPosition[position_id] ??= {
      position_id,
      product_id,
      direction,
      position_price: NaN,
      volume: 0,
      closable_price: NaN,
      floating_profit: 0,
      free_volume: 0,
      valuation: 0,
    });
  }

  onEvent(): void {
    // 根据订单更新头寸
    // ISSUE: 假设订单一旦成交即全部成交
    let balance = this.accountInfo.money.balance;
    for (let idx = this.orderIdx; idx < this.historyOrderUnit.historyOrders.length; idx++) {
      const order = this.historyOrderUnit.historyOrders[idx];

      if (order.profit_correction) {
        balance += order.profit_correction;
      }

      const theProduct = this.productDataUnit.getProduct(order.account_id, order.product_id)!;

      // 假设所有的 order 都有 position_id
      const variant = order.order_direction === 'OPEN_LONG' ? 'LONG' : 'SHORT';
      const thePosition = this.getPosition(order.position_id!, order.product_id, variant);
      if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'OPEN_SHORT') {
        // 开仓
        if (thePosition.volume === 0) {
          thePosition.position_price = order.traded_price!;
          thePosition.free_volume = thePosition.volume = order.volume;
        } else {
          // 开仓的时候，如果有头寸，就要更新头寸
          const nextVolume = roundToStep(thePosition.volume + order.volume, theProduct?.volume_step ?? 1);
          const nextPositionPrice = theProduct.value_scale_unit
            ? nextVolume /
              (thePosition.volume / thePosition.position_price + order.volume / order.traded_price!)
            : (thePosition.position_price * thePosition.volume + order.traded_price! * order.volume) /
              nextVolume;
          const position: IPosition = {
            ...thePosition,
            volume: nextVolume,
            free_volume: nextVolume,
            position_price: nextPositionPrice,
          };
          this.mapPositionIdToPosition[order.position_id!] = position;
        }
      } else {
        // 平仓
        if (thePosition.volume === 0) {
          // 平仓的时候，如果没有头寸，就不用管了
        } else {
          // 平仓的时候，如果有头寸，就要更新头寸
          const tradedVolume = roundToStep(
            Math.min(order.volume, thePosition.volume),
            theProduct?.volume_step ?? 1,
          );
          const nextVolume = roundToStep(thePosition.volume - tradedVolume, theProduct?.volume_step ?? 1);
          // 如果头寸已经平仓完了，就删除头寸
          if (nextVolume === 0) {
            delete this.mapPositionIdToPosition[order.position_id!];
          }
          thePosition.volume = nextVolume;
          thePosition.free_volume = nextVolume;
          // 更新余额
          balance += getProfit(
            theProduct,
            thePosition.position_price,
            order.traded_price!,
            tradedVolume,
            thePosition.direction!,
            this.accountInfo.money.currency,
            (product_id) => this.quoteDataUnit.getQuote(this.accountInfo.account_id, product_id),
          );
        }
      }
    }
    this.orderIdx = this.historyOrderUnit.historyOrders.length;

    // 检查因为报价变化导致的头寸变化
    const positions = Object.values(this.mapPositionIdToPosition)
      .filter((pos) => pos.volume > 0) // 过滤掉空的头寸
      .map((position): IPosition => {
        const product_id = position.product_id;
        const quote = this.quoteDataUnit.getQuote(this.accountInfo.account_id, product_id);
        const product = this.productDataUnit.getProduct(this.accountInfo.account_id, product_id);
        if (product && quote) {
          const closable_price = position.direction === 'LONG' ? quote.bid : quote.ask;
          const floating_profit = getProfit(
            product,
            position.position_price,
            closable_price,
            position.volume,
            position.direction!,
            this.accountInfo.money.currency,
            (product_id) => this.quoteDataUnit.getQuote(this.accountInfo.account_id, product_id),
          );
          const nextPosition = {
            ...position,
            closable_price,
            floating_profit,
          };
          this.mapPositionIdToPosition[nextPosition.position_id] = nextPosition;
          return nextPosition;
        }
        return position;
      });
    // 维护账户保证金
    const used = positions.reduce((acc, cur) => {
      const product = this.productDataUnit.getProduct(this.accountInfo.account_id, cur.product_id);
      if (!product) {
        return acc;
      }
      return (
        acc +
        getMargin(
          product,
          cur.position_price,
          cur.volume,
          cur.direction!,
          this.accountInfo.money.currency,
          (product_id) => this.quoteDataUnit.getQuote(this.accountInfo.account_id, product_id),
        ) /
          (this.accountInfo.money.leverage ?? 1)
      );
    }, 0);
    // 维护账户
    const profit = positions.reduce((acc, cur) => acc + cur.floating_profit, 0);
    const equity = balance + profit;
    const free = equity - used;
    const money: IAccountMoney = {
      ...this.accountInfo.money,
      equity,
      balance,
      profit,
      used,
      free,
    };
    this.accountInfo = {
      ...this.accountInfo,
      updated_at: this.kernel.currentTimestamp,
      money: money,
      currencies: [money],
      positions,
    };
  }
}
