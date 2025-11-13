import { createCache } from '@yuants/cache';
import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer } from 'rxjs';
import {
  getEarningAccountInfo,
  getFundingAccountInfo,
  getTradingAccountInfo,
  marketIndexTickerUSDT$,
} from './accountInfos';
import { getAccountConfig, getDefaultCredential, getTradeOrdersPending } from './api';

const terminal = Terminal.fromNodeEnv();

const credential = getDefaultCredential();

export const accountConfigCache = createCache(() => getAccountConfig(credential), {
  expire: 100_000,
  swrAfter: 10_000,
});

export const accountUidCache = createCache(async () => {
  const config = await accountConfigCache.query('');
  return config?.data[0].uid;
});

defer(async () => {
  const uid = await accountUidCache.query('');
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

export const getTradingAccountId = async () => {
  const uid = await accountUidCache.query('');
  return `okx/${uid}/trading`;
};

export const getStrategyAccountId = async () => {
  const uid = await accountUidCache.query('');
  return `okx/${uid}/strategy`;
};

defer(async () => {
  const tradingAccountId = await getTradingAccountId();
  addAccountMarket(terminal, { account_id: tradingAccountId, market_id: 'OKX' });

  provideAccountInfoService(terminal, tradingAccountId, () => getTradingAccountInfo(credential), {
    auto_refresh_interval: 1000,
  });
}).subscribe();

defer(async () => {
  const uid = await accountUidCache.query('');

  const fundingAccountId = `okx/${uid}/funding/USDT`;

  provideAccountInfoService(terminal, fundingAccountId, () => getFundingAccountInfo(credential), {
    auto_refresh_interval: 1000,
  });
}).subscribe();

defer(async () => {
  const uid = await accountUidCache.query('');
  const earningAccountId = `okx/${uid}/earning/USDT`;
  provideAccountInfoService(terminal, earningAccountId, () => getEarningAccountInfo(credential), {
    auto_refresh_interval: 5000,
  });
}).subscribe();

// 导出 marketIndexTickerUSDT$ 供其他模块使用
export { marketIndexTickerUSDT$ };
