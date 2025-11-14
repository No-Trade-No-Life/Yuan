import { createCache } from '@yuants/cache';
import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer } from 'rxjs';
import {
  getAccountInfo,
  getAllPositions,
  getDefaultCredential,
  getFutureAccounts,
  getFutureOrdersPending,
  getSpotAssets,
  getSpotOrdersPending,
} from './api/private-api';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

interface IAccountProfile {
  uid: string;
  parentId: string;
  isMainAccount: boolean;
}

export const accountProfileCache = createCache<IAccountProfile>(async () => {
  const res = await getAccountInfo(credential);
  if (res.msg !== 'success') {
    throw new Error(`Bitget getAccountInfo failed: ${res.code} ${res.msg}`);
  }
  const data = res.data;
  if (!data?.userId) {
    throw new Error(`Bitget getAccountInfo returned invalid payload: ${JSON.stringify(data)}`);
  }
  const uid = data.userId;
  const parentId = `${data.parentId ?? data.userId}`;
  return { uid, parentId, isMainAccount: uid === parentId };
});

const requireProfile = async () => {
  const profile = await accountProfileCache.query('');
  if (!profile) {
    throw new Error('Unable to resolve Bitget account profile');
  }
  return profile;
};

export const getFuturesAccountId = async () => {
  const { uid } = await requireProfile();
  return `bitget/${uid}/futures/USDT`;
};

export const getSpotAccountId = async () => {
  const { uid } = await requireProfile();
  return `bitget/${uid}/spot/USDT`;
};

export const getParentAccountId = async () => {
  const profile = await requireProfile();
  return profile.parentId;
};

export const getUid = async () => (await requireProfile()).uid;

export const isMainAccount = async () => {
  const profile = await requireProfile();
  return profile.isMainAccount;
};

const mapPosition = (position: any): IPosition => ({
  position_id: `${position.symbol}-${position.holdSide}`,
  datasource_id: 'BITGET',
  product_id: encodePath('USDT-FUTURES', position.symbol),
  direction: position.holdSide === 'long' ? 'LONG' : 'SHORT',
  volume: +position.total,
  free_volume: +position.available,
  position_price: +position.openPriceAvg,
  closable_price: +position.markPrice,
  floating_profit: +position.unrealizedPL,
  valuation: +position.total * +position.markPrice,
});

const mapOrderDirection = (order: any) => {
  const side = order.side;
  const tradeSide = order.tradeSide ?? order.posSide;
  if (tradeSide === 'open') {
    return side === 'buy' ? 'OPEN_LONG' : 'OPEN_SHORT';
  }
  if (tradeSide === 'close') {
    return side === 'buy' ? 'CLOSE_SHORT' : 'CLOSE_LONG';
  }
  if (tradeSide === 'long') {
    return side === 'buy' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (tradeSide === 'short') {
    return side === 'buy' ? 'CLOSE_SHORT' : 'OPEN_SHORT';
  }
  return side === 'buy' ? 'OPEN_LONG' : 'OPEN_SHORT';
};

const mapSpotOrders = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orderList)) return data.orderList;
  if (Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data.resultList)) return data.resultList;
  return [];
};

const mapSpotOrderDirection = (side?: string) => (side === 'sell' ? 'OPEN_SHORT' : 'OPEN_LONG');

defer(async () => {
  const accountId = await getFuturesAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'BITGET/USDT-FUTURE' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const balanceRes = await getFutureAccounts(credential, { productType: 'USDT-FUTURES' });
      if (balanceRes.msg !== 'success') {
        throw new Error(balanceRes.msg);
      }
      const positionsRes = await getAllPositions(credential, {
        productType: 'USDT-FUTURES',
        marginCoin: 'USDT',
      });
      if (positionsRes.msg !== 'success') {
        throw new Error(positionsRes.msg);
      }

      return {
        money: {
          currency: 'USDT',
          equity: +balanceRes.data[0].accountEquity,
          free: +balanceRes.data[0].maxTransferOut,
        },
        positions: positionsRes.data.map(mapPosition),
      };
    },
    { auto_refresh_interval: 1000 },
  );

  providePendingOrdersService(
    terminal,
    accountId,
    async () => {
      const res = await getFutureOrdersPending(credential, {
        productType: 'USDT-FUTURES',
        marginCoin: 'USDT',
      });
      if (res.msg !== 'success') {
        throw new Error(res.msg);
      }
      const list = res.data?.orderList ?? [];
      return list.map((order: any) => ({
        order_id: order.orderId,
        account_id: accountId,
        product_id: encodePath(order.productType ?? 'USDT-FUTURES', order.symbol),
        submit_at: +(order.cTime ?? order.createdTime ?? order.uTime ?? Date.now()),
        order_type:
          order.orderType === 'limit' ? 'LIMIT' : order.orderType === 'market' ? 'MARKET' : 'UNKNOWN',
        order_direction: mapOrderDirection(order),
        volume: +order.size,
        traded_volume: +(order.filledQty ?? 0),
        price: order.price ? +order.price : undefined,
        traded_price: order.priceAvg ? +order.priceAvg : undefined,
      }));
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();

defer(async () => {
  const accountId = await getSpotAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'BITGET/SPOT' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const res = await getSpotAssets(credential);
      if (res.msg !== 'success') {
        throw new Error(res.msg);
      }
      const equity = +(res.data.find((v: any) => v.coin === 'USDT')?.available ?? 0);
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

defer(async () => {
  const accountId = await getSpotAccountId();
  providePendingOrdersService(
    terminal,
    accountId,
    async () => {
      const res = await getSpotOrdersPending(credential);
      if (res.msg !== 'success') {
        throw new Error(res.msg);
      }
      const list = mapSpotOrders(res.data);
      return list
        .map((order) => {
          const symbol = order.symbol ?? order.instId;
          if (!symbol) return null;
          return {
            order_id: order.orderId ?? order.clientOid,
            account_id: accountId,
            product_id: encodePath('SPOT', symbol),
            order_type: order.orderType === 'market' ? 'MARKET' : 'LIMIT',
            order_direction: mapSpotOrderDirection(order.side),
            volume: +(order.size ?? order.quantity ?? order.baseSz ?? order.baseAmount ?? 0),
            traded_volume: +(order.fillSz ?? order.filledQty ?? order.baseFilled ?? 0),
            price: order.price ? +order.price : undefined,
            submit_at: +(order.cTime ?? order.createTime ?? order.createdTime ?? Date.now()),
          };
        })
        .filter((order): order is NonNullable<typeof order> => Boolean(order));
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();
