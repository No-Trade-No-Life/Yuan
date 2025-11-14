import { createCache } from '@yuants/cache';
import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer } from 'rxjs';
import { getDefaultCredential } from './api/client';
import {
  getSpotAccountInfo,
  getUnifiedAccountBalance,
  getUnifiedUmAccount,
  getUnifiedUmOpenOrders,
} from './api/private-api';
import { isBinanceErrorResponse } from './api/types';
import { mapBinanceOrderTypeToYuants, mapBinanceSideToYuantsDirection } from './order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

interface IBinanceAccountProfile {
  uid: string;
}

const accountProfileCache = createCache<IBinanceAccountProfile>(async () => {
  const res = await getSpotAccountInfo(credential, { omitZeroBalances: true });
  if (isBinanceErrorResponse(res)) {
    throw new Error(res.msg);
  }
  return { uid: `${res.uid}` };
});

const requireProfile = async () => {
  const profile = await accountProfileCache.query('profile');
  if (!profile) {
    throw new Error('Unable to resolve Binance account profile');
  }
  return profile;
};

export const getUnifiedAccountId = async () => {
  const { uid } = await requireProfile();
  return `binance/${uid}/unified/usdt`;
};

export const getSpotAccountId = async () => {
  const { uid } = await requireProfile();
  return `binance/${uid}/spot/usdt`;
};

export const getUid = async () => {
  const { uid } = await requireProfile();
  return uid;
};

const mapPosition = (position: any): IPosition => {
  const volume = +position.positionAmt;
  const entryPrice = +position.entryPrice;
  const unrealized = +position.unrealizedProfit;
  const avgPrice = volume === 0 ? entryPrice : entryPrice + (unrealized / volume || 0);
  return {
    position_id: `${position.symbol}/${position.positionSide}`,
    datasource_id: 'BINANCE',
    product_id: encodePath('usdt-future', position.symbol),
    direction: position.positionSide,
    volume,
    free_volume: volume,
    position_price: entryPrice,
    closable_price: avgPrice,
    floating_profit: unrealized,
    valuation: volume * avgPrice,
  };
};

const mapPendingOrder = (accountId: string) => (order: any): IOrder => {
  const order_direction = mapBinanceSideToYuantsDirection(order.side, order.positionSide) ?? 'OPEN_LONG';
  return {
    order_id: `${order.orderId}`,
    account_id: accountId,
    product_id: encodePath('usdt-future', order.symbol),
    order_type: mapBinanceOrderTypeToYuants(order.type),
    order_direction,
    volume: +order.origQty,
    traded_volume: +order.executedQty,
    price: order.price === undefined ? undefined : +order.price,
    submit_at: order.time,
    updated_at: new Date(order.updateTime).toISOString(),
    order_status: order.status,
  };
};

defer(async () => {
  const accountId = await getUnifiedAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'BINANCE/UNIFIED' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const [accountResult, umAccountResult] = await Promise.all([
        getUnifiedAccountBalance(credential),
        getUnifiedUmAccount(credential),
      ]);
      if (isBinanceErrorResponse(accountResult)) {
        throw new Error(accountResult.msg);
      }
      if (isBinanceErrorResponse(umAccountResult)) {
        throw new Error(umAccountResult.msg);
      }
      const usdtAsset = accountResult.find((asset) => asset.asset === 'USDT');
      if (!usdtAsset) {
        throw new Error('USDT asset not found in Binance unified account balance');
      }
      const umAsset = umAccountResult.assets.find((asset) => asset.asset === 'USDT');
      if (!umAsset) {
        throw new Error('USDT asset not found in Binance UM account info');
      }
      const equity = +usdtAsset.totalWalletBalance + +usdtAsset.umUnrealizedPNL;
      const free = equity - +umAsset.initialMargin;
      const positions = umAccountResult.positions.filter((pos) => +pos.positionAmt !== 0).map(mapPosition);
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

  providePendingOrdersService(
    terminal,
    accountId,
    async () => {
      const openOrders = await getUnifiedUmOpenOrders(credential);
      return openOrders.map(mapPendingOrder(accountId));
    },
    { auto_refresh_interval: 1000 },
  );
}).subscribe();

defer(async () => {
  const accountId = await getSpotAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'BINANCE/SPOT' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const res = await getSpotAccountInfo(credential, { omitZeroBalances: true });
      if (isBinanceErrorResponse(res)) {
        throw new Error(res.msg);
      }
      const usdtBalance = res.balances.find((v) => v.asset === 'USDT');
      const equity = +(usdtBalance?.free ?? 0);
      return {
        money: {
          currency: 'USDT',
          equity,
          free: equity,
        },
        positions: [],
      };
    },
    { auto_refresh_interval: 1000 },
  );
}).subscribe();
