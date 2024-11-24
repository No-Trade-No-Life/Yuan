import { IAccountInfo, encodePath, mergeAccountInfoPositions } from '@yuants/data-model';
import { ObservableInput, defer, first, mergeMap, pairwise } from 'rxjs';
import { PromRegistry } from '../services';
import { Terminal } from '../terminal';

const AccountInfoEquity = PromRegistry.create('gauge', 'account_info_equity');
const AccountInfoBalance = PromRegistry.create('gauge', 'account_info_balance');
const AccountInfoProfit = PromRegistry.create('gauge', 'account_info_profit');
const AccountInfoUsed = PromRegistry.create('gauge', 'account_info_used');
const AccountInfoFree = PromRegistry.create('gauge', 'account_info_free');
const AccountInfoPositionVolume = PromRegistry.create('gauge', 'account_info_position_volume');
const AccountInfoPositionPrice = PromRegistry.create('gauge', 'account_info_position_price');
const AccountInfoPositionClosablePrice = PromRegistry.create('gauge', 'account_info_position_closable_price');
const AccountInfoPositionFloatingProfit = PromRegistry.create(
  'gauge',
  'account_info_position_floating_profit',
);
const AccountInfoPositionValuation = PromRegistry.create('gauge', 'account_info_position_valuation');

/**
 * Provide a AccountInfo data stream, push to all subscriber terminals
 *
 * @public
 */
export const provideAccountInfo = (terminal: Terminal, accountInfo$: ObservableInput<IAccountInfo>) => {
  // setup services
  const sub = defer(() => accountInfo$)
    .pipe(first())
    .subscribe((info) => {
      const channel_id = encodePath(`AccountInfo`, info.account_id);
      terminal.provideChannel({ const: channel_id }, () => accountInfo$);

      // Metrics
      const sub2 = defer(() => accountInfo$)
        .pipe(
          //
          mergeMap(mergeAccountInfoPositions),
          pairwise(),
        )
        .subscribe(([lastAccountInfo, accountInfo]) => {
          AccountInfoBalance.set(accountInfo.money.balance, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoEquity.set(accountInfo.money.equity, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoProfit.set(accountInfo.money.profit, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoUsed.set(accountInfo.money.used, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoFree.set(accountInfo.money.free, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });

          for (const currency of lastAccountInfo.currencies || []) {
            AccountInfoBalance.set(currency.balance, {
              account_id: lastAccountInfo.account_id,
              currency: currency.currency,
            });
            AccountInfoEquity.set(currency.equity, {
              account_id: lastAccountInfo.account_id,
              currency: currency.currency,
            });
            AccountInfoProfit.set(currency.profit, {
              account_id: lastAccountInfo.account_id,
              currency: currency.currency,
            });
            AccountInfoUsed.set(currency.used, {
              account_id: lastAccountInfo.account_id,
              currency: currency.currency,
            });
            AccountInfoFree.set(currency.free, {
              account_id: lastAccountInfo.account_id,
              currency: currency.currency,
            });
          }

          for (const position of lastAccountInfo.positions) {
            AccountInfoPositionVolume.clear({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionPrice.clear({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionClosablePrice.clear({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionFloatingProfit.clear({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionValuation.clear({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
          }

          for (const position of accountInfo.positions) {
            AccountInfoPositionVolume.set(position.volume || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionPrice.set(position.position_price || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionClosablePrice.set(position.closable_price || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionFloatingProfit.set(position.floating_profit || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
            AccountInfoPositionValuation.set(position.valuation || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              direction: position.direction || '',
            });
          }
        });
      defer(() => terminal.dispose$).subscribe(() => sub2.unsubscribe());
    });
  defer(() => terminal.dispose$).subscribe(() => sub.unsubscribe());
};

/**
 * use account info data stream
 * @public
 */
export const useAccountInfo = (terminal: Terminal, account_id: string) =>
  terminal.consumeChannel<IAccountInfo>(encodePath(`AccountInfo`, account_id));
