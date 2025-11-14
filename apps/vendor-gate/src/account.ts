import { createCache } from '@yuants/cache';
import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { defer, firstValueFrom } from 'rxjs';
import { getDefaultCredential } from './api/client';
import {
  getAccountDetail,
  getFuturePositions,
  getFuturesAccounts,
  getFuturesOrders,
  getSpotAccounts,
  getUnifiedAccounts,
} from './api/private-api';
import { getSpotTickers } from './api/public-api';
import { mapProductIdToUsdtFutureProduct$ } from './public-data/product';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();
const FUTURE_SETTLE = 'usdt';

interface IAccountProfile {
  uid: string;
}

const accountProfileCache = createCache<IAccountProfile>(async () => {
  const detail = await getAccountDetail(credential);
  if (!detail?.user_id) {
    throw new Error(`Gate getAccountDetail returned invalid payload: ${JSON.stringify(detail)}`);
  }
  return { uid: `${detail.user_id}` };
});

const requireProfile = async () => {
  const profile = await accountProfileCache.query('profile');
  if (!profile) {
    throw new Error('Unable to resolve Gate profile');
  }
  return profile;
};

const buildAccountId = async (suffix: string) => {
  const { uid } = await requireProfile();
  return `gate/${uid}/${suffix}`;
};

export const getUid = async () => (await requireProfile()).uid;
export const getFutureAccountId = () => buildAccountId('future/USDT');
export const getSpotAccountId = () => buildAccountId('spot/USDT');
export const getUnifiedAccountId = () => buildAccountId('unified/USDT');

const mapPosition = (position: any, valueScale: number | undefined): IPosition => {
  const volume = Math.abs(position.size ?? 0);
  const closable_price = Number(position.mark_price ?? 0);
  const valuation = volume * closable_price * (valueScale ?? 1);
  return {
    datasource_id: 'GATE-FUTURE',
    position_id: `${position.contract}-${position.leverage}-${position.mode}`,
    product_id: position.contract,
    direction:
      position.mode === 'dual_long'
        ? 'LONG'
        : position.mode === 'dual_short'
        ? 'SHORT'
        : position.size > 0
        ? 'LONG'
        : 'SHORT',
    volume,
    free_volume: Math.abs(position.size ?? 0),
    position_price: Number(position.entry_price ?? 0),
    closable_price,
    floating_profit: Number(position.unrealised_pnl ?? 0),
    valuation,
  };
};

const loadFuturePositions = async () => {
  const [positionsRes, productMap] = await Promise.all([
    getFuturePositions(credential, FUTURE_SETTLE, undefined),
    firstValueFrom(mapProductIdToUsdtFutureProduct$),
  ]);
  const positions = Array.isArray(positionsRes) ? positionsRes : [];
  return positions.map((position) =>
    mapPosition(position, productMap.get(position.contract)?.value_scale ?? 1),
  );
};

const mapFutureOrderDirection = (order: any) => {
  const size = Number(order.size ?? 0);
  const isClose = Boolean(order.is_close ?? order.is_reduce_only ?? order.reduce_only);
  if (isClose) {
    return size > 0 ? 'CLOSE_SHORT' : 'CLOSE_LONG';
  }
  return size > 0 ? 'OPEN_LONG' : 'OPEN_SHORT';
};

const mapPendingOrder = (account_id: string) => (order: any) => {
  const size = Number(order.size ?? 0);
  const left = Number(order.left ?? Math.abs(size));
  const volume = Math.abs(size);
  const traded_volume = Math.max(volume - Math.abs(left), 0);
  return {
    order_id: `${order.id ?? order.text ?? ''}`,
    account_id,
    product_id: order.contract,
    submit_at: (Number(order.create_time ?? Date.now() / 1000) || 0) * 1000,
    order_type: order.price === '0' || order.tif === 'ioc' ? 'MARKET' : 'LIMIT',
    order_direction: mapFutureOrderDirection(order),
    volume,
    traded_volume,
    price: order.price ? Number(order.price) : undefined,
    traded_price: order.fill_price ? Number(order.fill_price) : undefined,
  };
};

defer(async () => {
  const accountId = await getFutureAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'GATE/USDT-FUTURE' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const [positions, account] = await Promise.all([
        loadFuturePositions(),
        getFuturesAccounts(credential, FUTURE_SETTLE),
      ]);
      const free = Number(account?.available ?? 0);
      const equity = Number(account?.total ?? 0) + Number(account?.unrealised_pnl ?? 0);
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
      const res = await getFuturesOrders(credential, FUTURE_SETTLE, { status: 'open', limit: 200 });
      const list = Array.isArray(res) ? res : [];
      return list.map(mapPendingOrder(accountId));
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();

defer(async () => {
  const accountId = await getUnifiedAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'GATE/UNIFIED' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const [positions, unifiedAccount, spotTickers] = await Promise.all([
        loadFuturePositions(),
        getUnifiedAccounts(credential, {}),
        getSpotTickers({}),
      ]);
      const balances: Record<string, { available: string }> = unifiedAccount?.balances ?? {};
      const tickerList = Array.isArray(spotTickers) ? spotTickers : [];
      const spotPositions: IPosition[] = Object.keys(balances)
        .map((currency) => {
          if (currency === 'USDT') return undefined;
          const currency_pair = currency === 'SOL2' ? 'SOL_USDT' : `${currency}_USDT`;
          const ticker = tickerList.find((v: any) => v.currency_pair === currency_pair);
          const price = Number(ticker?.last ?? 0);
          const volume = Number(balances[currency]?.available ?? 0);
          return {
            datasource_id: 'gate/spot',
            position_id: currency,
            product_id: currency,
            direction: 'LONG',
            volume,
            free_volume: volume,
            closable_price: price,
            position_price: price,
            floating_profit: 0,
            valuation: price * volume,
          };
        })
        .filter((x): x is IPosition => !!x);

      const free = Number(balances['USDT']?.available ?? 0);
      const equity = Number(unifiedAccount?.unified_account_total_equity ?? 0);
      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions: [...positions, ...spotPositions],
      };
    },
    { auto_refresh_interval: 1000 },
  );
}).subscribe();

defer(async () => {
  const accountId = await getSpotAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'GATE/SPOT' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const res = await getSpotAccounts(credential);
      if (!Array.isArray(res)) {
        throw new Error(`Gate getSpotAccounts failed: ${JSON.stringify(res)}`);
      }
      const equity = Number(res.find((item: any) => item.currency === 'USDT')?.available ?? 0);
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
