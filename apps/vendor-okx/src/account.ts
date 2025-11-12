import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer, filter, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { getAccountConfig, getDefaultCredential, getTradeOrdersPending } from './api';
import {
  getTradingAccountInfo,
  getFundingAccountInfo,
  getEarningAccountInfo,
  marketIndexTickerUSDT$,
} from './accountInfos';

const terminal = Terminal.fromNodeEnv();

const credential = getDefaultCredential();

export const accountConfig$ = defer(() => getAccountConfig(credential)).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

export const accountUid$ = accountConfig$.pipe(
  map((x) => x.data[0].uid),
  filter((x) => !!x),
  shareReplay(1),
);

defer(async () => {
  const uid = await firstValueFrom(accountUid$);
  const account_id = `okx/${uid}/trading`;
  providePendingOrdersService(
    terminal,
    account_id,
    async () => {
      const orders = await getTradeOrdersPending(credential, {});
      return orders.data.map((x) => {
        const order_type = x.ordType === 'market' ? 'MARKET' : x.ordType === 'limit' ? 'LIMIT' : 'UNKNOWN';

        const order_direction =
          x.side === 'buy'
            ? x.posSide === 'long'
              ? 'OPEN_LONG'
              : 'CLOSE_SHORT'
            : x.posSide === 'short'
            ? 'OPEN_SHORT'
            : 'CLOSE_LONG';
        return {
          order_id: x.ordId,
          account_id,
          product_id: encodePath(x.instType, x.instId),
          submit_at: +x.cTime,
          filled_at: +x.fillTime,
          order_type,
          order_direction,
          volume: +x.sz,
          traded_volume: +x.accFillSz,
          price: +x.px,
          traded_price: +x.avgPx,
        };
      });
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();

export const tradingAccountId$ = accountUid$.pipe(
  map((uid) => `okx/${uid}/trading`),
  shareReplay(1),
);

defer(async () => {
  const tradingAccountId = await firstValueFrom(tradingAccountId$);
  addAccountMarket(terminal, { account_id: tradingAccountId, market_id: 'OKX' });

  provideAccountInfoService(terminal, tradingAccountId, () => getTradingAccountInfo(credential), {
    auto_refresh_interval: 1000,
  });
}).subscribe();

defer(async () => {
  const uid = await firstValueFrom(accountUid$);

  const fundingAccountId = `okx/${uid}/funding/USDT`;

  provideAccountInfoService(terminal, fundingAccountId, () => getFundingAccountInfo(credential), {
    auto_refresh_interval: 1000,
  });
}).subscribe();

defer(async () => {
  const uid = await firstValueFrom(accountUid$);
  const earningAccountId = `okx/${uid}/earning/USDT`;
  provideAccountInfoService(terminal, earningAccountId, () => getEarningAccountInfo(credential), {
    auto_refresh_interval: 5000,
  });
}).subscribe();

// 导出 marketIndexTickerUSDT$ 供其他模块使用
export { marketIndexTickerUSDT$ };
