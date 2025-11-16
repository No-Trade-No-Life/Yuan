import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { ObservableInput, defer, mergeMap, pairwise, takeUntil, tap } from 'rxjs';
import { IAccountInfo } from './interface';
import { mergeAccountInfoPositions } from './mergeAccountInfoPositions';

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
  const AccountInfoEquity = terminal.metrics.gauge('account_info_equity', '');
  const AccountInfoBalance = terminal.metrics.gauge('account_info_balance', '');
  const AccountInfoProfit = terminal.metrics.gauge('account_info_profit', '');
  const AccountInfoUsed = terminal.metrics.gauge('account_info_used', '');
  const AccountInfoFree = terminal.metrics.gauge('account_info_free', '');
  const AccountInfoPositionVolume = terminal.metrics.gauge('account_info_position_volume', '');
  const AccountInfoPositionPrice = terminal.metrics.gauge('account_info_position_price', '');
  const AccountInfoPositionClosablePrice = terminal.metrics.gauge('account_info_position_closable_price', '');
  const AccountInfoPositionFloatingProfit = terminal.metrics.gauge(
    'account_info_position_floating_profit',
    '',
  );
  const AccountInfoPositionValuation = terminal.metrics.gauge('account_info_position_valuation', '');

  const channel2 = terminal.channel.publishChannel('AccountInfo', { const: account_id }, () => accountInfo$);

  // Metrics
  const sub = defer(() => accountInfo$)
    .pipe(
      //
      mergeMap(mergeAccountInfoPositions),
      pairwise(),
      tap(async ([lastAccountInfo, accountInfo]) => {
        try {
          if (accountInfo.positions.length === 0) return;
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(
              accountInfo.positions.map((item) => ({
                ...item,
                account_id,
              })),
              'position',
              {
                columns: [
                  'account_id',
                  'position_id',
                  'product_id',
                  'direction',
                  'volume',
                  'position_price',
                  'closable_price',
                  'floating_profit',
                ],
                conflictKeys: ['account_id', 'position_id'],
              },
            ),
          );
        } catch (e) {
          console.info(
            formatTime(Date.now()),
            'DeletePositionError',
            `Account_id:${JSON.stringify(accountInfo)}`,
            `Error:`,
            e,
          );
        }
      }),
      tap(async ([lastAccountInfo, accountInfo]) => {
        try {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(
              [
                {
                  account_id,
                  ...accountInfo.money,
                },
              ].map((item) =>
                Object.fromEntries(
                  Object.entries(item).map(([k, v]) => [k, typeof v === 'number' ? v.toString() : v]),
                ),
              ),
              'account_balance',
              {
                columns: [
                  'account_id',
                  'currency',
                  'equity',
                  'balance',
                  'profit',
                  'free',
                  'used',
                  'leverage',
                ],
                conflictKeys: ['account_id'],
              },
            ),
          );
        } catch (e) {
          console.info(
            formatTime(Date.now()),
            'UpdateAccountBalanceError',
            `AccountInfo:${JSON.stringify(accountInfo)}`,
            `Error:`,
            e,
          );
        }
      }),
      takeUntil(terminal.dispose$),
    )
    .subscribe(([lastAccountInfo, accountInfo]) => {
      AccountInfoBalance.labels({
        account_id,
        currency: accountInfo.money.currency,
      }).set(accountInfo.money.balance);

      AccountInfoEquity.labels({
        account_id,
        currency: accountInfo.money.currency,
      }).set(accountInfo.money.equity);

      AccountInfoProfit.labels({
        account_id,
        currency: accountInfo.money.currency,
      }).set(accountInfo.money.profit);

      AccountInfoUsed.labels({
        account_id,
        currency: accountInfo.money.currency,
      }).set(accountInfo.money.used);

      AccountInfoFree.labels({
        account_id,
        currency: accountInfo.money.currency,
      }).set(accountInfo.money.free);

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

      // ISSUE: https://github.com/open-telemetry/opentelemetry-js/issues/2997
      for (const position of lastAccountInfo.positions) {
        AccountInfoPositionVolume.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(0);
        AccountInfoPositionPrice.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(0);
        AccountInfoPositionClosablePrice.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(0);
        AccountInfoPositionFloatingProfit.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(0);
        AccountInfoPositionValuation.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(0);
      }

      for (const position of accountInfo.positions) {
        AccountInfoPositionVolume.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(position.volume);

        AccountInfoPositionPrice.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(position.position_price || 0);

        AccountInfoPositionClosablePrice.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(position.closable_price || 0);

        AccountInfoPositionFloatingProfit.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(position.floating_profit || 0);

        AccountInfoPositionValuation.labels({
          account_id,
          product_id: position.product_id,
          direction: position.direction || '',
        }).set(position.valuation || 0);
      }
    });

  return {
    dispose: () => {
      sub.unsubscribe();
      channel2.dispose();
    },
  };
};
