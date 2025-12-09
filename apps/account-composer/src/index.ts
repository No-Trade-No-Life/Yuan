import { IAccountInfo, publishAccountInfo } from '@yuants/data-account';
import { createClientProductCache, getProfit } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch, newError } from '@yuants/utils';
import {
  combineLatest,
  defer,
  map,
  Observable,
  repeat,
  retry,
  share,
  shareReplay,
  tap,
  throttleTime,
  timeout,
} from 'rxjs';
import { IAccountComposerConfig } from './interface';

const terminal = Terminal.fromNodeEnv();

const mapAccountIdToAccountInfo$: Record<string, Observable<IAccountInfo>> = {};

const cacheOfProduct = createClientProductCache(terminal);

defer(() =>
  requestSQL<IAccountComposerConfig[]>(
    terminal,
    `select * from account_composer_config where enabled = true`,
  ),
)
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
              x.sources
                .filter((xx) => xx.enabled)
                .map((y) =>
                  // Keep hot observable
                  (mapAccountIdToAccountInfo$[y.account_id] ??= terminal.channel
                    .subscribeChannel<IAccountInfo>('AccountInfo', y.account_id)
                    .pipe(share())).pipe(
                    map((x): IAccountInfo | undefined => {
                      const multiple = y.force_zero ? 0 : y.multiple ?? 1;

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
                            valuation: p.valuation * multiple,
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
                          .map((p) => {
                            const theDatasourceId = y.target_datasource_id
                              ? y.target_datasource_id
                              : p.datasource_id;
                            const theProductId = y.target_product_id ? y.target_product_id : p.product_id;

                            cacheOfProduct.query(theProductId, false); // SWR (Stale While Revalidate, Sync Mode)
                            const theProduct = cacheOfProduct.get(theProductId);
                            const theVolume = p.volume * multiple;

                            if (!theProduct) throw newError('ProductNotFound', { productKey: theProductId });

                            const theProfit = getProfit(
                              theProduct,
                              p.position_price,
                              p.closable_price,
                              theVolume,
                              p.direction || 'LONG',
                              // ISSUE: 先忽略了交叉盘的货币转换
                              theProduct.quote_currency!,
                              () => {
                                throw newError('ExchangeRateNotFound', { theProduct });
                              },
                            );

                            const theValuation = (theProduct.value_scale || 1) * theVolume * p.closable_price;

                            return {
                              ...p,
                              account_id: p.account_id || x.account_id,
                              product_id: theProductId,
                              datasource_id: theDatasourceId,
                              volume: theVolume,
                              free_volume: p.free_volume * multiple,
                              floating_profit: theProfit,
                              valuation: theValuation,
                            };
                          });
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
                          positions:
                            positions.length > 0
                              ? positions
                              : /** ISSUE: 没有头寸时也需要强行加一个，为了跟单的时候能知道它有这个配置 */
                                [
                                  {
                                    datasource_id: y.target_datasource_id || '',
                                    product_id: y.target_product_id || '',
                                    position_id: y.target_product_id || '',
                                    account_id: x.account_id,
                                    direction: 'LONG',
                                    volume: 0,
                                    free_volume: 0,
                                    position_price: 0,
                                    closable_price: 0,
                                    floating_profit: 0,
                                    valuation: 0,
                                  },
                                ],
                        };
                      }
                    }),
                    timeout(30_000),
                    tap({
                      error: (err) => {
                        terminal.metrics
                          .counter('account_composer_source_error', '')
                          .labels({
                            target_account: x.account_id,
                            source_account: y.account_id,
                          })
                          .inc();

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
