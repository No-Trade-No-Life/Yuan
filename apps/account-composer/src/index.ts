import { IAccountInfo, publishAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import {
  Observable,
  combineLatest,
  defer,
  map,
  repeat,
  retry,
  share,
  shareReplay,
  tap,
  throttleTime,
  timeout,
} from 'rxjs';
import { IAccountComposerConfig } from './interface';
import './migration';

const terminal = Terminal.fromNodeEnv();

const mapAccountIdToAccountInfo$: Record<string, Observable<IAccountInfo>> = {};

defer(() => requestSQL<IAccountComposerConfig[]>(terminal, `select * from account_composer_config`))
  .pipe(
    //
    tap((config) => console.info(formatTime(Date.now()), 'Loaded', JSON.stringify(config))),
    repeat({ delay: 10_000 }),
    retry({ delay: 10_000 }),
    shareReplay(1),
  )
  .pipe(
    listWatch(
      (x) => x.account_id,
      (x) =>
        new Observable(() => {
          console.info(
            formatTime(Date.now()),
            'AccountInfoConfig',
            x.account_id,
            x.updated_at,
            JSON.stringify(x),
          );
          const accountInfo$ = defer(() =>
            combineLatest(
              x.sources.map((y) =>
                // Keep hot observable
                (mapAccountIdToAccountInfo$[y.account_id] ??= terminal.channel
                  .subscribeChannel<IAccountInfo>('AccountInfo', y.account_id)
                  .pipe(share())).pipe(
                  map((x): IAccountInfo | undefined => {
                    const multiple = y.multiple ?? 1;

                    if (y.type === 'ALL') {
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
                        positions: x.positions.map((p) => ({
                          ...p,
                          account_id: p.account_id || x.account_id,
                          volume: p.volume * multiple,
                          free_volume: p.free_volume * multiple,
                          floating_profit: p.floating_profit * multiple,
                        })),
                      };
                    }
                    if (y.type === 'BY_PRODUCT') {
                      if (!y.source_product_id) return;
                      const positions = x.positions
                        .filter(
                          (p) =>
                            p.product_id === y.source_product_id &&
                            (y.source_datasource_id ? p.datasource_id === y.source_datasource_id : true),
                        )
                        .map((p) => ({
                          ...p,
                          account_id: p.account_id || x.account_id,
                          product_id: y.target_product_id ? y.target_product_id : p.product_id,
                          datasource_id: y.target_datasource_id ? y.target_datasource_id : p.datasource_id,
                          volume: p.volume * multiple,
                          free_volume: p.free_volume * multiple,
                          floating_profit: p.floating_profit * multiple,
                        }));
                      const sumProfit = positions.reduce((acc, p) => acc + p.floating_profit, 0);
                      return {
                        ...x,
                        money: {
                          currency: x.money.currency,
                          equity: sumProfit,
                          balance: 0,
                          profit: sumProfit,
                          used: sumProfit,
                          free: 0,
                        },
                        positions: positions,
                      };
                    }
                  }),
                  timeout(30_000),
                  tap({
                    error: (err) => {
                      console.info(
                        formatTime(Date.now()),
                        'AccountInfoError',
                        `target=${x.account_id}, source=${y.account_id}`,
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
            map((x) => x.filter((y): y is IAccountInfo => !!y)),
            map((accountInfos): IAccountInfo => {
              return {
                account_id: x.account_id,
                updated_at: Date.now(),
                money: {
                  currency: accountInfos[0]?.money.currency || '',
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
            console.info(formatTime(Date.now()), 'AccountInfoEmit', x.account_id);
          }); // Keep hot observable
          console.info(formatTime(Date.now()), 'AccountInfoPublish', x.account_id);
          const z = publishAccountInfo(terminal, x.account_id, accountInfo$);

          return () => {
            console.info(formatTime(Date.now()), 'AccountInfoUnpublish', x.account_id);
            z.dispose();
            sub.unsubscribe();
          };
        }),
      (a, b) => a.updated_at === b.updated_at,
    ),
  )
  .subscribe();
