import { IAccountInfo, IAccountMoney, publishAccountInfo } from '@yuants/data-account';
import { formatTime } from '@yuants/utils';
import {
  Observable,
  combineLatest,
  defer,
  groupBy,
  map,
  mergeMap,
  retry,
  share,
  shareReplay,
  tap,
  throttleTime,
  timeout,
  toArray,
} from 'rxjs';
import { requestSQL } from '../../../libraries/sql/lib';
import { terminal } from './terminal';

/**
 * Account Composition Relation
 *
 * target account is composed by source accounts.
 * the multiple is applied to the source account.
 * and then sum up to the target account.
 *
 */
interface IAccountCompositionRelation {
  source_account_id: string;
  target_account_id: string;
  multiple: number;
  hide_positions?: boolean;
}

const mapAccountIdToAccountInfo$: Record<string, Observable<IAccountInfo>> = {};

defer(() => requestSQL<IAccountCompositionRelation[]>(terminal, `select * from account_composition_relation`))
  .pipe(
    //
    tap((config) => console.info(formatTime(Date.now()), 'Loaded', JSON.stringify(config))),
    retry({ delay: 10_000 }),
    shareReplay(1),
  )
  .pipe(
    mergeMap((x) => x),
    groupBy((x) => x.target_account_id),
    mergeMap((group) =>
      group.pipe(
        toArray(),
        tap((x) => {
          const accountInfo$ = defer(() =>
            combineLatest(
              x.map((y) =>
                // Keep hot observable
                (mapAccountIdToAccountInfo$[y.source_account_id] ??= terminal.channel
                  .subscribeChannel<IAccountInfo>('AccountInfo', y.source_account_id)
                  .pipe(share())).pipe(
                  map((x): IAccountInfo => {
                    const multiple = y.multiple ?? 1;
                    return {
                      ...x,
                      money: {
                        ...x.money,
                        equity: x.money.equity * multiple,
                        balance: x.money.balance * multiple,
                        profit: x.money.profit * multiple,
                        used: x.money.used * multiple,
                        free: x.money.free * multiple,
                      },
                      currencies:
                        x.currencies?.map((c) => ({
                          ...c,
                          equity: c.equity * multiple,
                          balance: c.balance * multiple,
                          profit: c.profit * multiple,
                          used: c.used * multiple,
                          free: c.free * multiple,
                        })) ?? [],
                      positions: y.hide_positions
                        ? []
                        : x.positions.map((p) => ({
                            ...p,
                            account_id: p.account_id || x.account_id,
                            volume: p.volume * multiple,
                            free_volume: p.free_volume * multiple,
                            floating_profit: p.floating_profit * multiple,
                          })),
                    };
                  }),
                  timeout(30_000),
                ),
              ),
            ),
          ).pipe(
            retry(),
            throttleTime(1000),
            map((accountInfos): IAccountInfo => {
              const mapCurrencyToCurrentInfo: Record<string, IAccountMoney> = {};
              accountInfos.forEach((x) => {
                x.currencies?.forEach((c) => {
                  const y = (mapCurrencyToCurrentInfo[c.currency] ??= {
                    currency: c.currency,
                    equity: 0,
                    balance: 0,
                    profit: 0,
                    used: 0,
                    free: 0,
                  });
                  y.equity += c.equity;
                  y.balance += c.balance;
                  y.profit += c.profit;
                  y.used += c.used;
                  y.free += c.free;
                });
              });
              return {
                account_id: group.key,
                updated_at: Date.now(),
                money: {
                  currency: accountInfos[0].money.currency,
                  equity: accountInfos.reduce((acc, x) => acc + x.money.equity, 0),
                  balance: accountInfos.reduce((acc, x) => acc + x.money.balance, 0),
                  profit: accountInfos.reduce((acc, x) => acc + x.money.profit, 0),
                  used: accountInfos.reduce((acc, x) => acc + x.money.used, 0),
                  free: accountInfos.reduce((acc, x) => acc + x.money.free, 0),
                },
                currencies: Object.values(mapCurrencyToCurrentInfo),
                positions: accountInfos.flatMap((x) => x.positions),
                orders: accountInfos.flatMap((x) => x.orders),
              };
            }),
            share(),
          );
          accountInfo$.subscribe(); // Keep hot observable
          publishAccountInfo(terminal, group.key, accountInfo$);
        }),
      ),
    ),
  )
  .subscribe();
