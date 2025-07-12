import { Meter } from '@opentelemetry/api';
import { mergeAccountInfoPositions } from '@yuants/data-model';
import { MetricsMeterProvider, Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { ObservableInput, defer, mergeMap, pairwise, takeUntil, tap } from 'rxjs';
import './interface';
import { IAccountInfo, IOrder } from './interface';
import './migration';
export * from './interface';

const AccountMeter: Meter = MetricsMeterProvider.getMeter('account');

const AccountInfoEquity = AccountMeter.createGauge('account_info_equity');
const AccountInfoBalance = AccountMeter.createGauge('account_info_balance');
const AccountInfoProfit = AccountMeter.createGauge('account_info_profit');
const AccountInfoUsed = AccountMeter.createGauge('account_info_used');
const AccountInfoFree = AccountMeter.createGauge('account_info_free');
const AccountInfoPositionVolume = AccountMeter.createGauge('account_info_position_volume');
const AccountInfoPositionPrice = AccountMeter.createGauge('account_info_position_price');
const AccountInfoPositionClosablePrice = AccountMeter.createGauge('account_info_position_closable_price');
const AccountInfoPositionFloatingProfit = AccountMeter.createGauge('account_info_position_floating_profit');
const AccountInfoPositionValuation = AccountMeter.createGauge('account_info_position_valuation');

declare module '@yuants/protocol/lib/services' {
  /**
   * - Order operation interface has been loaded
   * - 订单操作接口已载入
   */
  interface IService {
    SubmitOrder: {
      req: IOrder;
      res: IResponse;
      frame: void;
    };
    ModifyOrder: {
      req: IOrder;
      res: IResponse;
      frame: void;
    };
    CancelOrder: {
      req: IOrder;
      res: IResponse;
      frame: void;
    };
  }
}

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
      tap(async ([lastAccountInfo, accountInfo]) => {
        try {
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
