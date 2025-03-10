import { IAccountInfo, IAccountMoney, formatTime, getDataRecordSchema } from '@yuants/data-model';
import { Terminal, publishAccountInfo, readDataRecords } from '@yuants/protocol';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  Observable,
  combineLatest,
  defer,
  filter,
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

const TERMINAL_ID = process.env.TERMINAL_ID || `AccountComposer`;
const terminal = new Terminal(process.env.HOST_URL!, { terminal_id: TERMINAL_ID, name: 'Account Composer' });

const ajv = new Ajv({ strict: false });
addFormats(ajv);

const validate = ajv.compile(getDataRecordSchema('account_composition_relation')!);

const mapAccountIdToAccountInfo$: Record<string, Observable<IAccountInfo>> = {};

defer(() => readDataRecords(terminal, { type: 'account_composition_relation' }))
  .pipe(
    //
    mergeMap((x) => x),
    map((msg) => msg.origin),
    filter((x) => validate(x)),
    toArray(),
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
          );
          publishAccountInfo(terminal, group.key, accountInfo$);
        }),
      ),
    ),
  )
  .subscribe();
