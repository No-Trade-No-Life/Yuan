import { Meter } from '@opentelemetry/api';
import { IOrder } from '@yuants/data-order';
import { MetricsMeterProvider, Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import {
  Observable,
  ObservableInput,
  defer,
  from,
  groupBy,
  map,
  mergeMap,
  pairwise,
  reduce,
  takeUntil,
  tap,
  toArray,
} from 'rxjs';
import './interface';
import { IAccountInfo, IAccountMoney, IPosition, IPositionDiff } from './interface';
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
      res: IResponse<{
        order_id?: string;
      }>;
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

/**
 * write account market info to db
 *
 * @public
 */
export const addAccountMarket = async (
  terminal: Terminal,
  cxt: { account_id: string; market_id: string },
) => {
  const { account_id, market_id } = cxt;
  try {
    await requestSQL(
      terminal,
      `
        INSERT INTO account_market (account_id, market_id) values (${escapeSQL(account_id)}, ${escapeSQL(
        market_id,
      )}) ON CONFLICT (account_id, market_id) DO NOTHING;
      `,
    );
  } catch (e) {
    console.error(
      formatTime(Date.now()),
      'AddAccountMarketError',
      `accountId: ${account_id}, marketId: ${market_id}`,
      `Error: `,
      e,
    );
  }
};

/**
 * Calculate position differences, automatically merging positions with the same product_id/direction
 * @public
 * @param source - Source position list
 * @param target - Target position list
 * @returns - Position difference list
 */
export const diffPosition = (source: IPosition[], target: IPosition[]) => {
  const positionDiffMap = new Map<string, IPositionDiff>();

  for (const position of source) {
    const key = `${position.product_id}-${position.direction}`;

    if (positionDiffMap.has(key)) {
      const existingDiff = positionDiffMap.get(key)!;
      existingDiff.volume_in_source += position.volume;
    } else {
      positionDiffMap.set(key, {
        product_id: position.product_id,
        direction: position.direction!,
        volume_in_source: position.volume,
        volume_in_target: 0,
        error_volume: 0,
      });
    }
  }

  for (const position of target) {
    const key = `${position.product_id}-${position.direction}`;

    if (positionDiffMap.has(key)) {
      const existingDiff = positionDiffMap.get(key)!;
      existingDiff.volume_in_target += position.volume;
    } else {
      positionDiffMap.set(key, {
        product_id: position.product_id,
        direction: position.direction!,
        volume_in_source: 0,
        volume_in_target: position.volume,
        error_volume: 0,
      });
    }
  }

  const result: IPositionDiff[] = [];
  for (const diff of positionDiffMap.values()) {
    diff.error_volume = diff.volume_in_source - diff.volume_in_target;
    result.push(diff);
  }

  return result;
};

/**
 * @public
 */
export const createEmptyAccountInfo = (
  account_id: string,
  currency: string,
  leverage: number = 1,
  initial_balance: number = 0,
): IAccountInfo => {
  const money: IAccountMoney = {
    currency,
    leverage,
    equity: initial_balance,
    balance: initial_balance,
    profit: 0,
    used: 0,
    free: 0,
  };
  return {
    updated_at: 0,
    account_id,
    money: money,
    positions: [],
  };
};
/**
 * Merge Positions by their product_id and direction
 * @public
 */
export const mergeAccountInfoPositions = (info: IAccountInfo): Observable<IAccountInfo> => {
  return from(info.positions).pipe(
    groupBy((position) => position.product_id),
    mergeMap((groupWithSameProductId) =>
      groupWithSameProductId.pipe(
        groupBy((position) => position.direction),
        mergeMap((groupWithSameVariant) =>
          groupWithSameVariant.pipe(
            reduce(
              (acc: IPosition, cur: IPosition): IPosition => ({
                ...acc,
                volume: acc.volume + cur.volume,
                free_volume: acc.free_volume + cur.free_volume,
                position_price:
                  (acc.position_price * acc.volume + cur.position_price * cur.volume) /
                  (acc.volume + cur.volume),
                floating_profit: acc.floating_profit + cur.floating_profit,
                closable_price:
                  (acc.closable_price * acc.volume + cur.closable_price * cur.volume) /
                  (acc.volume + cur.volume),
                valuation: acc.valuation + cur.valuation,
              }),
            ),
          ),
        ),
      ),
    ),
    toArray(),
    map((positions): IAccountInfo => ({ ...info, positions })),
  );
};
