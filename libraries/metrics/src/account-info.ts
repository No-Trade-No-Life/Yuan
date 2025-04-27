import { IAccountInfo, mergeAccountInfoPositions } from '@yuants/data-model';
import { PromRegistry } from '@yuants/protocol';
import { defer, mergeMap, ObservableInput, pairwise } from 'rxjs';

const MetricsAccountInfoEquity =
  PromRegistry.get('gauge', 'account_info_equity') ?? PromRegistry.create('gauge', 'account_info_equity');
const MetricsAccountInfoBalance =
  PromRegistry.get('gauge', 'account_info_balance') ?? PromRegistry.create('gauge', 'account_info_balance');
const MetricsAccountInfoProfit =
  PromRegistry.get('gauge', 'account_info_profit') ?? PromRegistry.create('gauge', 'account_info_profit');
const MetricsAccountInfoUsed =
  PromRegistry.get('gauge', 'account_info_used') ?? PromRegistry.create('gauge', 'account_info_used');
const MetricsAccountInfoFree =
  PromRegistry.get('gauge', 'account_info_free') ?? PromRegistry.create('gauge', 'account_info_free');
const MetricsAccountInfoPositionVolume =
  PromRegistry.get('gauge', 'account_info_position_volume') ??
  PromRegistry.create('gauge', 'account_info_position_volume');
const MetricsAccountInfoPositionPrice =
  PromRegistry.get('gauge', 'account_info_position_price') ??
  PromRegistry.create('gauge', 'account_info_position_price');
const MetricsAccountInfoPositionClosablePrice =
  PromRegistry.get('gauge', 'account_info_position_closable_price') ??
  PromRegistry.create('gauge', 'account_info_position_closable_price');
const MetricsAccountInfoPositionFloatingProfit =
  PromRegistry.get('gauge', 'account_info_position_floating_profit') ??
  PromRegistry.create('gauge', 'account_info_position_floating_profit');
const MetricsAccountInfoPositionValuation =
  PromRegistry.get('gauge', 'account_info_position_valuation') ??
  PromRegistry.create('gauge', 'account_info_position_valuation');

/**
 * Perform account info metrics recording
 *
 * @param lastAccountInfo - last account info
 * @param accountInfo - current account info
 *
 * @public
 */
export const PerformAccountInfoMetrics = (lastAccountInfo: IAccountInfo, accountInfo: IAccountInfo) => {
  {
    const account_id = accountInfo.account_id;
    MetricsAccountInfoBalance.set(accountInfo.money.balance, {
      account_id,
      currency: accountInfo.money.currency,
    });
    MetricsAccountInfoEquity.set(accountInfo.money.equity, {
      account_id,
      currency: accountInfo.money.currency,
    });
    MetricsAccountInfoProfit.set(accountInfo.money.profit, {
      account_id,
      currency: accountInfo.money.currency,
    });
    MetricsAccountInfoUsed.set(accountInfo.money.used, {
      account_id,
      currency: accountInfo.money.currency,
    });
    MetricsAccountInfoFree.set(accountInfo.money.free, {
      account_id,
      currency: accountInfo.money.currency,
    });
  }

  for (const currency of lastAccountInfo.currencies || []) {
    const account_id = lastAccountInfo.account_id;
    MetricsAccountInfoBalance.clear({
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoEquity.clear({
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoProfit.clear({
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoUsed.clear({
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoFree.clear({
      account_id,
      currency: currency.currency,
    });
  }

  for (const currency of accountInfo.currencies || []) {
    const account_id = accountInfo.account_id;
    MetricsAccountInfoBalance.set(currency.balance, {
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoEquity.set(currency.equity, {
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoProfit.set(currency.profit, {
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoUsed.set(currency.used, {
      account_id,
      currency: currency.currency,
    });
    MetricsAccountInfoFree.set(currency.free, {
      account_id,
      currency: currency.currency,
    });
  }

  for (const position of lastAccountInfo.positions) {
    const account_id = lastAccountInfo.account_id;
    MetricsAccountInfoPositionVolume.clear({
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionPrice.clear({
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionClosablePrice.clear({
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionFloatingProfit.clear({
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionValuation.clear({
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
  }

  for (const position of accountInfo.positions) {
    const account_id = accountInfo.account_id;
    MetricsAccountInfoPositionVolume.set(position.volume || 0, {
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionPrice.set(position.position_price || 0, {
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionClosablePrice.set(position.closable_price || 0, {
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionFloatingProfit.set(position.floating_profit || 0, {
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
    MetricsAccountInfoPositionValuation.set(position.valuation || 0, {
      account_id,
      product_id: position.product_id,
      direction: position.direction || '',
    });
  }
};

/**
 * Provide a AccountInfo data stream, push to all subscriber terminals
 *
 * @public
 */
export const SetupAccountInfoMetrics = (accountInfo$: ObservableInput<IAccountInfo>) => {
  // Metrics
  const sub = defer(() => accountInfo$)
    .pipe(
      //
      mergeMap(mergeAccountInfoPositions),
      pairwise(),
    )
    .subscribe(([lastAccountInfo, accountInfo]) => {
      PerformAccountInfoMetrics(lastAccountInfo, accountInfo);
    });
  return {
    dispose: () => {
      sub.unsubscribe();
    },
  };
};
