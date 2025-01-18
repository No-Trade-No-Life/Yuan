import { IAccountInfo, encodePath, mergeAccountInfoPositions } from '@yuants/data-model';
import { ObservableInput, defer, first, mergeMap, pairwise, takeUntil } from 'rxjs';
import { publishChannel } from '../channel';
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
      publishAccountInfo(terminal, info.account_id, accountInfo$);
    });
  defer(() => terminal.dispose$).subscribe(() => sub.unsubscribe());
};

/**
 * Provide a AccountInfo data stream, push to all subscriber terminals
 *
 * @public
 */
export const publishAccountInfo = (
  terminal: Terminal,
  account_id: string,
  accountInfo$: ObservableInput<IAccountInfo>,
) => {
  const channel_id = encodePath(`AccountInfo`, account_id);
  const channel1 = terminal.provideChannel({ const: channel_id }, () => accountInfo$);
  const channel2 = publishChannel(terminal, 'AccountInfo', { const: account_id }, () => accountInfo$);

  // Metrics
  const sub = defer(() => accountInfo$)
    .pipe(
      //
      mergeMap(mergeAccountInfoPositions),
      pairwise(),
      takeUntil(terminal.dispose$),
    )
    .subscribe(([lastAccountInfo, accountInfo]) => {
      AccountInfoBalance.set(accountInfo.money.balance, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoEquity.set(accountInfo.money.equity, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoProfit.set(accountInfo.money.profit, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoUsed.set(accountInfo.money.used, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoFree.set(accountInfo.money.free, {
        account_id,
        currency: accountInfo.money.currency,
      });

      for (const currency of lastAccountInfo.currencies || []) {
        AccountInfoBalance.clear({
          account_id,
          currency: currency.currency,
        });
        AccountInfoEquity.clear({
          account_id,
          currency: currency.currency,
        });
        AccountInfoProfit.clear({
          account_id,
          currency: currency.currency,
        });
        AccountInfoUsed.clear({
          account_id,
          currency: currency.currency,
        });
        AccountInfoFree.clear({
          account_id,
          currency: currency.currency,
        });
      }

      for (const currency of accountInfo.currencies || []) {
        AccountInfoBalance.set(currency.balance, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoEquity.set(currency.equity, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoProfit.set(currency.profit, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoUsed.set(currency.used, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoFree.set(currency.free, {
          account_id,
          currency: currency.currency,
        });
      }

      for (const position of lastAccountInfo.positions) {
        AccountInfoPositionVolume.clear({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionPrice.clear({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionClosablePrice.clear({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionFloatingProfit.clear({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionValuation.clear({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
      }

      for (const position of accountInfo.positions) {
        AccountInfoPositionVolume.set(position.volume || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionPrice.set(position.position_price || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionClosablePrice.set(position.closable_price || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionFloatingProfit.set(position.floating_profit || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionValuation.set(position.valuation || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
      }
    });
  return {
    dispose: () => {
      sub.unsubscribe();
      channel1.dispose();
      channel2.dispose();
    },
  };
};

/**
 * use account info data stream
 * @public
 */
export const useAccountInfo = (terminal: Terminal, account_id: string) =>
  terminal.consumeChannel<IAccountInfo>(encodePath(`AccountInfo`, account_id));
