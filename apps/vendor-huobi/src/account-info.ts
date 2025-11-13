import { IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import {
  defer,
  distinct,
  filter,
  first,
  firstValueFrom,
  from,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import { client } from './api';
import {
  getSpotAccountBalance,
  getSpotTick,
  getSwapCrossPositionInfo,
  getUnifiedAccountInfo,
  ICredential,
} from './api/private-api';
import { swapProductService } from './product';

/**
 * 提供 SWAP 账户信息服务
 */
export const provideSwapAccountInfoService = (
  terminal: Terminal,
  accountId: string,
  credential: ICredential,
) => {
  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      // balance
      const balance = await getUnifiedAccountInfo(credential);
      if (!balance.data) {
        throw new Error('Failed to get unified account info');
      }
      const balanceData = balance.data.find((v) => v.margin_asset === 'USDT');
      if (!balanceData) {
        throw new Error('No USDT balance found in unified account');
      }
      const equity = balanceData.margin_balance;
      const free = balanceData.withdraw_available;

      // positions
      const positionsRes = await getSwapCrossPositionInfo(credential);
      const mapProductIdToPerpetualProduct = await firstValueFrom(swapProductService.mapProductIdToProduct$);
      const positions: IPosition[] = (positionsRes.data || []).map((v): IPosition => {
        const product_id = v.contract_code;
        const theProduct = mapProductIdToPerpetualProduct?.get(product_id);
        const valuation = v.volume * v.last_price * (theProduct?.value_scale || 1);
        return {
          position_id: `${v.contract_code}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
          datasource_id: 'HUOBI-SWAP',
          product_id,
          direction: v.direction === 'buy' ? 'LONG' : 'SHORT',
          volume: v.volume,
          free_volume: v.available,
          position_price: v.cost_hold,
          closable_price: v.last_price,
          floating_profit: v.profit_unreal,
          valuation,
        };
      });

      // orders
      // const orders: IOrder[] = [];
      // let page_index = 1;
      // const page_size = 50;

      // while (true) {
      //   const ordersRes = await client.getSwapOpenOrders({ page_index, page_size });
      //   if (!ordersRes.data?.orders || ordersRes.data.orders.length === 0) {
      //     break;
      //   }

      //   const pageOrders: IOrder[] = ordersRes.data.orders.map((v): IOrder => {
      //     return {
      //       order_id: v.order_id_str,
      //       account_id: SWAP_ACCOUNT_ID,
      //       product_id: v.contract_code,
      //       order_type: ['lightning'].includes(v.order_price_type)
      //         ? 'MARKET'
      //         : ['limit', 'opponent', 'post_only', 'optimal_5', 'optimal_10', 'optimal_20'].includes(
      //             v.order_price_type,
      //           )
      //         ? 'LIMIT'
      //         : ['fok'].includes(v.order_price_type)
      //         ? 'FOK'
      //         : v.order_price_type.includes('ioc')
      //         ? 'IOC'
      //         : 'STOP', // unreachable code
      //       order_direction:
      //         v.direction === 'open'
      //           ? v.offset === 'buy'
      //             ? 'OPEN_LONG'
      //             : 'OPEN_SHORT'
      //           : v.offset === 'buy'
      //           ? 'CLOSE_SHORT'
      //           : 'CLOSE_LONG',
      //       volume: v.volume,
      //       submit_at: v.created_at,
      //       price: v.price,
      //       traded_volume: v.trade_volume,
      //     };
      //   });

      //   orders.push(...pageOrders);
      //   page_index++;
      // }

      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions,
      };
    },
    { auto_refresh_interval: 1000 },
  );
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
    async () => {
      // get account balance
      const accountBalance = await getSpotAccountBalance(credential, superMarginAccountUid);
      const balanceList = accountBalance.data?.list || [];

      // calculate usdt balance
      const usdtBalance = balanceList
        .filter((v) => v.currency === 'usdt')
        .reduce((acc, cur) => acc + +cur.balance, 0);

      // get positions (non-usdt currencies)
      const positions: IPosition[] = [];
      const nonUsdtCurrencies = balanceList
        .filter((v) => v.currency !== 'usdt')
        .reduce((acc, cur) => {
          const existing = acc.find((item) => item.currency === cur.currency);
          if (existing) {
            existing.balance += +cur.balance;
          } else {
            acc.push({ currency: cur.currency, balance: +cur.balance });
          }
          return acc;
        }, [] as { currency: string; balance: number }[]);

      // get prices and create positions
      for (const currencyData of nonUsdtCurrencies) {
        if (currencyData.balance > 0) {
          try {
            // get current price from websocket or fallback to REST API
            let price: number;
            try {
              const tickPrice = await firstValueFrom(
                client.spot_ws.input$.pipe(
                  //
                  first((v) => v.ch?.includes('ticker') && v.ch?.includes(currencyData.currency) && v.tick),
                  map((v): number => v.tick.bid),
                  timeout(5000),
                  tap({
                    error: (e) => {
                      subscriptions.clear();
                    },
                  }),
                ),
              );
              price = tickPrice;
            } catch {
              // fallback to REST API
              const tickerRes = await getSpotTick(credential, { symbol: `${currencyData.currency}usdt` });
              price = tickerRes.tick.close;
            }

            positions.push({
              position_id: `${currencyData.currency}/usdt/spot`,
              product_id: `${currencyData.currency}usdt`,
              direction: 'LONG',
              volume: currencyData.balance,
              free_volume: currencyData.balance,
              position_price: price,
              closable_price: price,
              floating_profit: 0,
              valuation: currencyData.balance * price,
            });
          } catch (error) {
            console.warn(formatTime(Date.now()), `Failed to get price for ${currencyData.currency}:`, error);
          }
        }
      }

      // calculate equity
      const equity = positions.reduce((acc, cur) => acc + cur.closable_price * cur.volume, 0) + usdtBalance;

      return {
        money: {
          currency: 'USDT',
          equity,
          free: equity,
        },
        positions,
      };
    },
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
  spotAccountUid: number,
) => {
  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const spotBalance = await getSpotAccountBalance(credential, spotAccountUid);

      const equity = +(spotBalance.data.list.find((v) => v.currency === 'usdt')?.balance ?? 0);
      const free = equity;
      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions: [],
      };
    },
    { auto_refresh_interval: 1000 },
  );
};
