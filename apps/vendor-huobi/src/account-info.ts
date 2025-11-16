import { provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { defer, distinct, filter, from, map, mergeMap, repeat, retry, shareReplay, tap, toArray } from 'rxjs';
import { getSpotAccountInfo } from './accounts/spot';
import { getSuperMarginAccountInfo } from './accounts/super-margin';
import { getSwapAccountInfo } from './accounts/swap';
import { client } from './api';
import { getSpotAccountBalance, ICredential } from './api/private-api';

/**
 * 提供 SWAP 账户信息服务
 */
export const provideSwapAccountInfoService = (
  terminal: Terminal,
  accountId: string,
  credential: ICredential,
) => {
  provideAccountInfoService(terminal, accountId, async () => getSwapAccountInfo(credential, accountId), {
    auto_refresh_interval: 1000,
  });
};

/**
 * 获取超级保证金账户余额流
 */
export const getSuperMarginAccountBalance$ = (credential: ICredential, superMarginAccountUid: number) => {
  return defer(() => getSpotAccountBalance(credential, superMarginAccountUid)).pipe(
    //
    map((res) => res.data),
    repeat({ delay: 1000 }),
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'unifiedRaw', e);
      },
    }),
    retry({ delay: 5000 }),
    shareReplay(1),
  );
};

/**
 * 设置超级保证金账户的 WebSocket 订阅
 */
export const setupSuperMarginWebSocketSubscriptions = (
  superMarginAccountBalance$: ReturnType<typeof getSuperMarginAccountBalance$>,
  subscriptions: Set<string>,
) => {
  from(client.spot_ws.connection$).subscribe(() => {
    subscriptions.clear();
  });
  // subscribe the symbols of positions we held
  superMarginAccountBalance$
    .pipe(
      //
      mergeMap((res) =>
        from(res?.list || []).pipe(
          filter((v) => v.currency !== 'usdt'),
          map((v) => v.currency),
          distinct(),
          toArray(),
          map((v) => new Set(v)),
        ),
      ),
    )
    .subscribe((v: Set<string>) => {
      const toUnsubscribe = [...subscriptions].filter((x) => !v.has(x));
      const toSubscribe = [...v].filter((x) => !subscriptions.has(x));

      for (const symbol of toUnsubscribe) {
        client.spot_ws.output$.next({
          unsub: `market.${symbol}usdt.ticker`,
        });
        subscriptions.delete(symbol);
      }
      for (const symbol of toSubscribe) {
        client.spot_ws.output$.next({
          sub: `market.${symbol}usdt.ticker`,
        });
        subscriptions.add(symbol);
      }
    });
};

/**
 * 提供超级保证金账户信息服务
 */
export const provideSuperMarginAccountInfoService = (
  terminal: Terminal,
  accountId: string,
  credential: ICredential,
  superMarginAccountUid: number,
  subscriptions: Set<string>,
) => {
  const superMarginAccountBalance$ = getSuperMarginAccountBalance$(credential, superMarginAccountUid);
  setupSuperMarginWebSocketSubscriptions(superMarginAccountBalance$, subscriptions);

  provideAccountInfoService(
    terminal,
    accountId,
    async () => getSuperMarginAccountInfo(credential, accountId),
    { auto_refresh_interval: 1000 },
  );

  return superMarginAccountBalance$;
};

/**
 * 提供 SPOT 账户信息服务
 */
export const provideSpotAccountInfoService = (
  terminal: Terminal,
  accountId: string,
  credential: ICredential,
) => {
  provideAccountInfoService(terminal, accountId, async () => getSpotAccountInfo(credential, accountId), {
    auto_refresh_interval: 1000,
  });
};
