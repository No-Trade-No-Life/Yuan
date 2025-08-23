import { IAccountInfo, publishAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import {
  Observable,
  combineLatest,
  defer,
  from,
  groupBy,
  map,
  mergeMap,
  repeat,
  retry,
  share,
  shareReplay,
  tap,
  throttleTime,
  timeout,
  toArray,
} from 'rxjs';

const terminal = Terminal.fromNodeEnv();

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
  created_at: string;
  updated_at: string;
}

const mapAccountIdToAccountInfo$: Record<string, Observable<IAccountInfo>> = {};

defer(() => requestSQL<IAccountCompositionRelation[]>(terminal, `select * from account_composition_relation`))
  .pipe(
    //
    tap((config) => console.info(formatTime(Date.now()), 'Loaded', JSON.stringify(config))),
    repeat({ delay: 10_000 }),
    retry({ delay: 10_000 }),
    shareReplay(1),
  )
  .pipe(
    mergeMap((x) =>
      from(x).pipe(
        groupBy((x) => x.target_account_id),
        mergeMap((group) =>
          group.pipe(
            toArray(),
            map((x) => ({
              target_account_id: group.key,
              sources: x,
              updated_at: x.map((y) => new Date(y.updated_at).getTime()).reduce((a, b) => Math.max(a, b), 0),
            })),
          ),
        ),
        toArray(),
      ),
    ),
    listWatch(
      (x) => x.target_account_id,
      (x) =>
        new Observable(() => {
          console.info(
            formatTime(Date.now()),
            'AccountInfoConfig',
            x.target_account_id,
            x.updated_at,
            JSON.stringify(x),
          );
          const accountInfo$ = defer(() =>
            combineLatest(
              x.sources.map((y) =>
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
                  tap({
                    error: (err) => {
                      console.info(
                        formatTime(Date.now()),
                        'AccountInfoError',
                        `target=${x.target_account_id}, source=${y.source_account_id}`,
                        err,
                      );
                    },
                  }),
                ),
              ),
            ),
          ).pipe(
            retry(),
            throttleTime(1000),
            map((accountInfos): IAccountInfo => {
              return {
                account_id: x.target_account_id,
                updated_at: Date.now(),
                money: {
                  currency: accountInfos[0].money.currency,
                  equity: accountInfos.reduce((acc, x) => acc + x.money.equity, 0),
                  balance: accountInfos.reduce((acc, x) => acc + x.money.balance, 0),
                  profit: accountInfos.reduce((acc, x) => acc + x.money.profit, 0),
                  used: accountInfos.reduce((acc, x) => acc + x.money.used, 0),
                  free: accountInfos.reduce((acc, x) => acc + x.money.free, 0),
                },
                positions: accountInfos.flatMap((x) => x.positions),
              };
            }),
            share(),
          );
          const sub = accountInfo$.subscribe(() => {
            console.info(formatTime(Date.now()), 'AccountInfoEmit', x.target_account_id);
          }); // Keep hot observable
          console.info(formatTime(Date.now()), 'AccountInfoPublish', x.target_account_id);
          const z = publishAccountInfo(terminal, x.target_account_id, accountInfo$);

          return () => {
            console.info(formatTime(Date.now()), 'AccountInfoUnpublish', x.target_account_id);
            z.dispose();
            sub.unsubscribe();
          };
        }),
      (a, b) => a.updated_at === b.updated_at,
    ),
  )
  .subscribe();
