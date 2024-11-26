import { IAccountInfo, IOrder, IPosition, IProduct, getMargin, getProfit } from '@yuants/data-model';
import { observableToAsyncIterable, roundToStep } from '@yuants/utils';
import { Subject } from 'rxjs';
import { IAccountInfoResolver } from './model';

/**
 * @public
 */
export class AccountInfoResolver implements IAccountInfoResolver {
  mapAccountIdToAccountInfo: Map<string, IAccountInfo> = new Map();
  updateOrder(order: IOrder): void {
    this.unresolvedOrders.add(order);
    this.update();
  }
  updateQuote(product_id: string, quote: { ask: number; bid: number }): void {
    this.mapProductIdToQuote.set(product_id, quote);
    this.dirtyProductIds.add(product_id);
    this.update();
  }
  updateProduct(product: IProduct): void {
    this.mapProductIdToProduct.set(product.product_id, product);
    this.dirtyProductIds.add(product.product_id);
    this.update();
  }

  updateAccountInfo(accountInfo: IAccountInfo): void {
    this.mapAccountIdToAccountInfo.set(accountInfo.account_id, accountInfo);
    // update indexing
    this.mapAccountIdToPositionIdToPosition[accountInfo.account_id] = {};
    this.mapAccountIdToProductIdToPositions[accountInfo.account_id] = {};
    for (const position of accountInfo.positions) {
      this.mapAccountIdToPositionIdToPosition[accountInfo.account_id][position.position_id] = position;
      (this.mapAccountIdToProductIdToPositions[accountInfo.account_id][position.product_id] ??= []).push(
        position,
      );
      (this.mapProductIdToPositions[position.product_id] ??= new Set()).add(position);
    }
  }

  private _positionExit$ = new Subject<IPosition>();
  positionExit$: AsyncIterable<IPosition> = observableToAsyncIterable(this._positionExit$);

  private dirtyPositions = new Set<IPosition>();
  private dirtyProductIds: Set<string> = new Set();
  private mapProductIdToProduct = new Map<string, IProduct>();
  private mapProductIdToQuote = new Map<string, { ask: number; bid: number }>();

  private unresolvedOrders = new Set<IOrder>();

  // Account Indexing, Reuse Reference, Enhance Performance
  private mapAccountIdToPositionIdToPosition: Record<string, Record<string, IPosition>> = {};
  private mapAccountIdToProductIdToPositions: Record<string, Record<string, IPosition[]>> = {};
  private mapProductIdToPositions: Record<string, Set<IPosition>> = {};

  private getPosition = (
    account_id: string,
    position_id: string,
    product_id: string,
    direction: string,
  ): IPosition => {
    const mapPositionIdToPosition = this.mapAccountIdToPositionIdToPosition[account_id];
    if (!mapPositionIdToPosition[position_id]) {
      const newPosition: IPosition = {
        position_id,
        account_id,
        product_id,
        direction,
        position_price: NaN,
        volume: 0,
        closable_price: NaN,
        floating_profit: 0,
        free_volume: 0,
        valuation: 0,
        margin: 0,
      };
      mapPositionIdToPosition[position_id] = newPosition;
      this.mapAccountIdToAccountInfo.get(account_id)!.positions.push(newPosition);
      (this.mapAccountIdToProductIdToPositions[account_id][product_id] ??= []).push(newPosition);
      (this.mapProductIdToPositions[product_id] ??= new Set()).add(newPosition);
    }
    return mapPositionIdToPosition[position_id];
  };

  private removePosition(account_id: string, position_id: string) {
    const theAccountInfo = this.mapAccountIdToAccountInfo.get(account_id);
    if (!theAccountInfo) throw new Error('account not found');
    delete this.mapAccountIdToPositionIdToPosition[account_id][position_id];
    const positions = theAccountInfo.positions;
    const idx = positions.findIndex((position) => position.position_id === position_id);
    if (idx < 0) throw new Error('position not found');
    const thePosition = positions[idx];
    positions.splice(idx, 1);
    const product_id = thePosition.product_id;
    const productPositions = this.mapAccountIdToProductIdToPositions[account_id][product_id];
    const idx2 = productPositions.findIndex((position) => position.position_id === position_id);
    if (idx2 < 0) throw new Error('position not found');
    productPositions.splice(idx2, 1);
    theAccountInfo.money.used -= thePosition.margin || 0;
    theAccountInfo.money.profit -= thePosition.floating_profit || 0;
    this.mapProductIdToPositions[product_id].delete(thePosition);
    if (this.mapProductIdToPositions[product_id].size === 0) {
      delete this.mapProductIdToPositions[product_id];
    }
    this._positionExit$.next(thePosition);
  }

  private update() {
    // 根据订单更新头寸
    while (true) {
      const toRemove: IOrder[] = [];
      for (const order of this.unresolvedOrders) {
        if (!order.position_id || !order.traded_volume) {
          continue;
        }

        // check if the order is valid
        const theAccountInfo = this.mapAccountIdToAccountInfo.get(order.account_id);
        if (!theAccountInfo) {
          continue;
        }

        const theProduct = this.mapProductIdToProduct.get(order.product_id);
        if (!theProduct) {
          continue;
        }

        // 假设所有的 order 都有 position_id
        const variant =
          order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG' ? 'LONG' : 'SHORT';
        const thePosition = this.getPosition(
          theAccountInfo.account_id,
          order.position_id,
          order.product_id,
          variant,
        );

        if (order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT') {
          if (
            Math.abs(thePosition.volume - order.traded_volume) > theProduct.volume_step! &&
            thePosition.volume < order.traded_volume
          ) {
            continue;
          }
        }
        // the order is valid
        toRemove.push(order);
        this.dirtyPositions.add(thePosition);
        if (order.profit_correction) {
          theAccountInfo.money.balance += order.profit_correction;
        }
        thePosition.updated_at = order.filled_at;

        // ISSUE: 假设订单一旦成交即全部成交
        if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'OPEN_SHORT') {
          // 开仓
          if (thePosition.volume === 0) {
            thePosition.position_price = order.traded_price!;
            thePosition.free_volume = thePosition.volume = order.traded_volume;
            thePosition.total_opened_volume = (thePosition.total_opened_volume || 0) + order.traded_volume;
          } else {
            // 开仓的时候，如果有头寸，就要更新头寸
            const nextVolume = roundToStep(
              thePosition.volume + order.traded_volume,
              theProduct.volume_step ?? 1,
            );
            const nextPositionPrice = theProduct.value_scale_unit
              ? nextVolume /
                (thePosition.volume / thePosition.position_price + order.traded_volume / order.traded_price!)
              : (thePosition.position_price * thePosition.volume +
                  order.traded_price! * order.traded_volume) /
                nextVolume;
            thePosition.free_volume = thePosition.volume = nextVolume;
            thePosition.position_price = nextPositionPrice;
            thePosition.total_opened_volume = (thePosition.total_opened_volume || 0) + order.traded_volume;
          }
        } else {
          // 平仓
          const tradedVolume = roundToStep(order.traded_volume, theProduct.volume_step ?? 1);
          const nextVolume = roundToStep(thePosition.volume - tradedVolume, theProduct.volume_step ?? 1);
          thePosition.free_volume = thePosition.volume = nextVolume;
          const realized_profit = getProfit(
            theProduct,
            thePosition.position_price,
            order.traded_price!,
            tradedVolume,
            thePosition.direction!,
            theAccountInfo.money.currency,
            (product_id) => this.mapProductIdToQuote.get(product_id),
          );
          thePosition.realized_pnl = (thePosition.realized_pnl || 0) + realized_profit;
          thePosition.total_closed_volume = (thePosition.total_closed_volume || 0) + tradedVolume;
          // 更新余额
          theAccountInfo.money.balance += realized_profit;
          // 如果头寸已经平仓完了，就删除头寸
          if (nextVolume === 0) {
            this.removePosition(theAccountInfo.account_id, order.position_id);
          }
        }
      }
      if (toRemove.length === 0) break;
      for (const order of toRemove) {
        this.unresolvedOrders.delete(order);
      }
    }

    // 检查因为报价变化导致的头寸变化
    for (const product_id of this.dirtyProductIds) {
      const influencedPositions = this.mapProductIdToPositions[product_id];
      if (!influencedPositions) continue;
      for (const position of influencedPositions) {
        this.dirtyPositions.add(position);
      }
    }
    this.dirtyProductIds.clear();

    const dirtyAccountIds = new Set<string>();
    // 重新计算头寸
    for (const position of this.dirtyPositions) {
      if (!(position.volume > 0)) continue; // 过滤掉空的头寸，刚刚平仓的头寸
      if (!position.account_id) throw new Error('position.account_id not found');
      const account_id = position.account_id;
      const theAccountInfo = this.mapAccountIdToAccountInfo.get(account_id);
      if (!theAccountInfo) throw new Error(`Account not found: ${account_id}`);
      const product_id = position.product_id;
      const quote = this.mapProductIdToQuote.get(product_id);
      const product = this.mapProductIdToProduct.get(product_id);
      if (!product) throw new Error(`Product not found: ${product_id}`);

      // Position is valid.
      const closable_price = position.direction === 'LONG' ? quote?.bid || 0 : quote?.ask || 0;
      const floating_profit =
        getProfit(
          product,
          position.position_price,
          closable_price,
          position.volume,
          position.direction!,
          theAccountInfo.money.currency,
          (product_id) => this.mapProductIdToQuote.get(product_id),
        ) || 0;
      // 维护账户保证金
      const used =
        getMargin(
          product,
          position.position_price,
          position.volume,
          position.direction!,
          theAccountInfo.money.currency,
          (product_id) => this.mapProductIdToQuote.get(product_id),
        ) / (theAccountInfo.money.leverage ?? 1) || 0;
      const valuation = position.volume * closable_price * (product.value_scale ?? 1);
      const nextAccountFloatingProfit =
        theAccountInfo.money.profit + floating_profit - (position.floating_profit || 0);
      const nextAccountMargin = theAccountInfo.money.used + used - (position.margin || 0);
      // modify
      position.closable_price = closable_price;
      position.floating_profit = floating_profit;
      position.valuation = valuation;
      position.margin = used;
      theAccountInfo.money.profit = nextAccountFloatingProfit;
      theAccountInfo.money.used = nextAccountMargin;
      dirtyAccountIds.add(account_id);
    }

    for (const accountId of dirtyAccountIds) {
      const theAccountInfo = this.mapAccountIdToAccountInfo.get(accountId);
      if (!theAccountInfo) throw new Error(`account not found: ${accountId}`);
      const equity = theAccountInfo.money.balance + theAccountInfo.money.profit;
      theAccountInfo.money.equity = equity;
      theAccountInfo.money.free = equity - theAccountInfo.money.used;
      // NOTE: don't change the account info's updated_at, it should be updated by the caller
    }
  }
}
