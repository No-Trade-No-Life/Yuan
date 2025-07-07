import './interface';
import './migration';
export * from './interface';
import { IAccountInfo, mergeAccountInfoPositions } from '@yuants/data-model';
import { ObservableInput, defer, first, mergeMap, pairwise, takeUntil } from 'rxjs';
import { TerminalMeter } from './metrics';
import { Terminal } from '@yuants/protocol';

const AccountInfoEquity = TerminalMeter.createGauge('account_info_equity');
const AccountInfoBalance = TerminalMeter.createGauge('account_info_balance');
const AccountInfoProfit = TerminalMeter.createGauge('account_info_profit');
const AccountInfoUsed = TerminalMeter.createGauge('account_info_used');
const AccountInfoFree = TerminalMeter.createGauge('account_info_free');
const AccountInfoPositionVolume = TerminalMeter.createGauge('account_info_position_volume');
const AccountInfoPositionPrice = TerminalMeter.createGauge('account_info_position_price');
const AccountInfoPositionClosablePrice = TerminalMeter.createGauge('account_info_position_closable_price');
const AccountInfoPositionFloatingProfit = TerminalMeter.createGauge('account_info_position_floating_profit');
const AccountInfoPositionValuation = TerminalMeter.createGauge('account_info_position_valuation');

// /**
//  * Provide a AccountInfo data stream, push to all subscriber terminals
//  *
//  * @public
//  */
// export const provideAccountInfo = (terminal: Terminal, accountInfo$: ObservableInput<IAccountInfo>) => {
//   // setup services
//   const sub = defer(() => accountInfo$)
//     .pipe(first())
//     .subscribe((info) => {
//       publishAccountInfo(terminal, info.account_id, accountInfo$);
//     });
//   defer(() => terminal.dispose$).subscribe(() => sub.unsubscribe());
// };

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
  const channel2 = terminal.channel.publishChannel('AccountInfo', { const: account_id }, () => accountInfo$);

  // Metrics
  const sub = defer(() => accountInfo$)
    .pipe(
      //
      mergeMap(mergeAccountInfoPositions),
      pairwise(),
      takeUntil(terminal.dispose$),
    )
    .subscribe(([lastAccountInfo, accountInfo]) => {
      AccountInfoBalance.record(accountInfo.money.balance, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoEquity.record(accountInfo.money.equity, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoProfit.record(accountInfo.money.profit, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoUsed.record(accountInfo.money.used, {
        account_id,
        currency: accountInfo.money.currency,
      });
      AccountInfoFree.record(accountInfo.money.free, {
        account_id,
        currency: accountInfo.money.currency,
      });

      // ISSUE: https://github.com/open-telemetry/opentelemetry-js/issues/2997
      // for (const currency of lastAccountInfo.currencies || []) {
      //   AccountInfoBalance.clear({
      //     account_id,
      //     currency: currency.currency,
      //   });
      //   AccountInfoEquity.clear({
      //     account_id,
      //     currency: currency.currency,
      //   });
      //   AccountInfoProfit.clear({
      //     account_id,
      //     currency: currency.currency,
      //   });
      //   AccountInfoUsed.clear({
      //     account_id,
      //     currency: currency.currency,
      //   });
      //   AccountInfoFree.clear({
      //     account_id,
      //     currency: currency.currency,
      //   });
      // }

      for (const currency of accountInfo.currencies || []) {
        AccountInfoBalance.record(currency.balance, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoEquity.record(currency.equity, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoProfit.record(currency.profit, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoUsed.record(currency.used, {
          account_id,
          currency: currency.currency,
        });
        AccountInfoFree.record(currency.free, {
          account_id,
          currency: currency.currency,
        });
      }

      // ISSUE: https://github.com/open-telemetry/opentelemetry-js/issues/2997
      // for (const position of lastAccountInfo.positions) {
      //   AccountInfoPositionVolume.clear({
      //     account_id,
      //     product_id: position.product_id,
      //     direction: position.direction || '',
      //   });
      //   AccountInfoPositionPrice.clear({
      //     account_id,
      //     product_id: position.product_id,
      //     direction: position.direction || '',
      //   });
      //   AccountInfoPositionClosablePrice.clear({
      //     account_id,
      //     product_id: position.product_id,
      //     direction: position.direction || '',
      //   });
      //   AccountInfoPositionFloatingProfit.clear({
      //     account_id,
      //     product_id: position.product_id,
      //     direction: position.direction || '',
      //   });
      //   AccountInfoPositionValuation.clear({
      //     account_id,
      //     product_id: position.product_id,
      //     direction: position.direction || '',
      //   });
      // }

      for (const position of accountInfo.positions) {
        AccountInfoPositionVolume.record(position.volume || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionPrice.record(position.position_price || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionClosablePrice.record(position.closable_price || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionFloatingProfit.record(position.floating_profit || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
        AccountInfoPositionValuation.record(position.valuation || 0, {
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        });
      }
    });
  return {
    dispose: () => {
      sub.unsubscribe();
      channel2.dispose();
    },
  };
};

/**
 * use account info data stream
 * @public
 */
export const useAccountInfo = (terminal: Terminal, account_id: string) =>
  terminal.channel.subscribeChannel<IAccountInfo>('AccountInfo', account_id);
