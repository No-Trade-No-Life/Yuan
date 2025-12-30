import { IAccountInfo, IPosition, createEmptyAccountInfo } from '@yuants/data-account';
import { roundToStep } from '@yuants/utils';
import { takeUntil } from 'rxjs';
import { Kernel } from '../kernel';
import { getMargin, getProfit } from '../utils';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { QuoteDataUnit } from './QuoteDataUnit';

/**
 * @public
 */
export class AccountInfoUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public quoteDataUnit: QuoteDataUnit,
    public historyOrderUnit: HistoryOrderUnit,
  ) {
    super(kernel);
  }

  onInit(): void | Promise<void> {
    this.historyOrderUnit.orderUpdated$.pipe(takeUntil(this.kernel.dispose$)).subscribe(() => this.onEvent());
  }

  orderIdx = 0;

  private mapAccountIdToBalance: Record<string, number> = {};

  private mapAccountIdToPositionIdToPosition: Record<string, Record<string, IPosition>> = {}; // 复用引用，增强性能
  private mapAccountIdToPositions: Record<string, IPosition[]> = {}; // 复用引用，增强性能
  private mapAccountIdToProductIdToPositions: Record<string, Record<string, IPosition[]>> = {}; // 复用引用，增强性能
  private mapAccountIdToPositionIdToUsed: Record<string, Record<string, number | undefined>> = {};
  private mapAccountIdToPositionIdToFloatingProfit: Record<string, Record<string, number | undefined>> = {};

  mapAccountIdToAccountInfo: Map<string, IAccountInfo> = new Map();

  useAccount(account_id: string, currency: string, leverage?: number, initial_balance?: number) {
    const accountInfo = this.mapAccountIdToAccountInfo.get(account_id);
    if (accountInfo) {
      return accountInfo;
    }
    const newAccountInfo = createEmptyAccountInfo(account_id, currency, leverage, initial_balance);
    this.mapAccountIdToBalance[account_id] = newAccountInfo.money.balance;
    this.mapAccountIdToPositions[account_id] = newAccountInfo.positions;
    this.mapAccountIdToAccountInfo.set(account_id, newAccountInfo);
    this.mapAccountIdToPositionIdToPosition[account_id] = {};
    this.mapAccountIdToProductIdToPositions[account_id] = {};
    this.mapAccountIdToPositionIdToFloatingProfit[account_id] = {};
    this.mapAccountIdToPositionIdToUsed[account_id] = {};
    return newAccountInfo;
  }

  getPosition = (
    account_id: string,
    position_id: string,
    product_id: string,
    direction: string,
  ): IPosition => {
    const mapPositionIdToPosition = this.mapAccountIdToPositionIdToPosition[account_id];
    if (!mapPositionIdToPosition[position_id]) {
      const initPosition = {
        position_id,
        product_id,
        direction,
        position_price: NaN,
        volume: 0,
        closable_price: NaN,
        floating_profit: 0,
        free_volume: 0,
        valuation: 0,
      };
      mapPositionIdToPosition[position_id] = initPosition;
      this.mapAccountIdToPositions[account_id].push(initPosition);
      (this.mapAccountIdToProductIdToPositions[account_id][product_id] ??= []).push(initPosition);
    }
    return mapPositionIdToPosition[position_id];
  };

  private removePosition(account_id: string, position_id: string) {
    delete this.mapAccountIdToPositionIdToPosition[account_id][position_id];
    const positions = this.mapAccountIdToPositions[account_id];
    const idx = positions.findIndex((position) => position.position_id === position_id);
    if (idx < 0) return;
    const thePosition = positions[idx];
    positions.splice(idx, 1);
    const product_id = thePosition.product_id;
    const productPositions = this.mapAccountIdToProductIdToPositions[account_id][product_id];
    const idx2 = productPositions.findIndex((position) => position.position_id === position_id);
    if (idx2 < 0) return;
    productPositions.splice(idx2, 1);
    const theAccountInfo = this.mapAccountIdToAccountInfo.get(account_id);
    if (!theAccountInfo) return;
    theAccountInfo.money.used -= this.mapAccountIdToPositionIdToUsed[account_id][position_id] || 0;
    delete this.mapAccountIdToPositionIdToUsed[account_id][position_id];
    theAccountInfo.money.profit -=
      this.mapAccountIdToPositionIdToFloatingProfit[account_id][position_id] || 0;
    delete this.mapAccountIdToPositionIdToFloatingProfit[account_id][position_id];
  }

  updateAccountInfo(accountId: string) {
    const theAccountInfo = this.mapAccountIdToAccountInfo.get(accountId);

    if (!theAccountInfo) {
      return;
    }

    // 根据订单更新头寸
    const dirtyProductIds = new Set<string>(this.quoteDataUnit.dirtyProductIds);
    // ISSUE: 假设订单一旦成交即全部成交
    for (let idx = this.orderIdx; idx < this.historyOrderUnit.historyOrders.length; idx++) {
      const order = this.historyOrderUnit.historyOrders[idx];
      if (order.account_id !== accountId) {
        continue;
      }
      dirtyProductIds.add(order.product_id);
      if (order.profit_correction) {
        this.mapAccountIdToBalance[accountId] =
          (this.mapAccountIdToBalance[accountId] || 0) + order.profit_correction;
      }

      // 假设所有的 order 都有 position_id
      const variant =
        order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG' ? 'LONG' : 'SHORT';
      const thePosition = this.getPosition(accountId, order.position_id!, order.product_id, variant);
      if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'OPEN_SHORT') {
        // 开仓
        if (thePosition.volume === 0) {
          thePosition.position_price = order.traded_price!;
          thePosition.free_volume = thePosition.volume = order.volume;
        } else {
          // 开仓的时候，如果有头寸，就要更新头寸
          const nextVolume = roundToStep(thePosition.volume + order.volume, 1);
          const nextPositionPrice =
            (thePosition.position_price * thePosition.volume + order.traded_price! * order.volume) /
            nextVolume;
          thePosition.volume = nextVolume;
          thePosition.free_volume = nextVolume;
          thePosition.position_price = nextPositionPrice;
        }
      } else {
        // 平仓
        if (thePosition.volume === 0) {
          // 平仓的时候，如果没有头寸，就不用管了
        } else {
          // 平仓的时候，如果有头寸，就要更新头寸
          const tradedVolume = roundToStep(Math.min(order.volume, thePosition.volume), 1);
          const nextVolume = roundToStep(thePosition.volume - tradedVolume, 1);
          thePosition.volume = nextVolume;
          thePosition.free_volume = nextVolume;
          // 更新余额
          this.mapAccountIdToBalance[accountId] =
            (this.mapAccountIdToBalance[accountId] || 0) +
            getProfit(
              null,
              thePosition.position_price,
              order.traded_price!,
              tradedVolume,
              thePosition.direction!,
              theAccountInfo.money.currency,
              (product_id) => this.quoteDataUnit.getQuote(accountId, product_id),
            );
        }
      }
      // 如果头寸已经平仓完了或者没有形成有效成交，就删除头寸，防止泄漏
      if (thePosition.volume === 0) {
        this.removePosition(accountId, thePosition.position_id);
      }
    }

    // 检查因为报价变化导致的头寸变化
    const mapProductIdToPositions = (this.mapAccountIdToProductIdToPositions[accountId] ??= {});
    for (const product_id of dirtyProductIds) {
      const influencedPositions = mapProductIdToPositions[product_id];
      if (!influencedPositions) continue;
      for (const position of influencedPositions) {
        if (!(position.volume > 0)) continue; // 过滤掉空的头寸
        const product_id = position.product_id;
        const quote = this.quoteDataUnit.getQuote(accountId, product_id);
        if (quote) {
          const closable_price = position.direction === 'LONG' ? quote.bid : quote.ask;
          const floating_profit =
            getProfit(
              null,
              position.position_price,
              closable_price,
              position.volume,
              position.direction!,
              theAccountInfo.money.currency,
              (product_id) => this.quoteDataUnit.getQuote(accountId, product_id),
            ) || 0;
          position.closable_price = closable_price;
          position.floating_profit = floating_profit;
          theAccountInfo.money.profit +=
            floating_profit -
            (this.mapAccountIdToPositionIdToFloatingProfit[accountId][position.position_id] || 0);
          this.mapAccountIdToPositionIdToFloatingProfit[accountId][position.position_id] = floating_profit;
        }
        // 维护账户保证金
        const used =
          getMargin(
            null,
            position.position_price,
            position.volume,
            position.direction!,
            theAccountInfo.money.currency,
            (product_id) => this.quoteDataUnit.getQuote(accountId, product_id),
          ) / (theAccountInfo.money.leverage ?? 1) || 0;
        theAccountInfo.money.used +=
          used - (this.mapAccountIdToPositionIdToUsed[accountId][position.position_id] || 0);
        this.mapAccountIdToPositionIdToUsed[accountId][position.position_id] = used;
      }
    }

    // 维护账户
    const balance = this.mapAccountIdToBalance[accountId] || 0;
    const equity = balance + theAccountInfo.money.profit;
    const money = theAccountInfo.money;
    money.equity = equity;
    money.balance = balance;
    money.free = equity - theAccountInfo.money.used;
    theAccountInfo.updated_at = this.kernel.currentTimestamp;
  }

  onEvent(): void | Promise<void> {
    for (const accountId of this.mapAccountIdToAccountInfo.keys()) {
      this.updateAccountInfo(accountId);
    }
    this.orderIdx = this.historyOrderUnit.historyOrders.length;
  }

  dump() {
    return {
      mapAccountIdToAccountInfo: Object.fromEntries(this.mapAccountIdToAccountInfo.entries()),
      mapAccountIdToBalance: this.mapAccountIdToBalance,
      mapAccountIdToPositionIdToPosition: this.mapAccountIdToPositionIdToPosition,
      orderIdx: this.orderIdx,
    };
  }

  restore(state: any) {
    this.mapAccountIdToAccountInfo = new Map(
      Object.entries(state.mapAccountIdToAccountInfo).map(([key, value]: any): [string, IAccountInfo] => [
        key,
        value,
      ]),
    );
    this.mapAccountIdToBalance = state.mapAccountIdToBalance;
    this.mapAccountIdToPositionIdToPosition = state.mapAccountIdToPositionIdToPosition;
    this.orderIdx = state.orderIdx;
  }
}
