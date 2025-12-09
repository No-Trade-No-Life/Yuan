import { createCache } from '@yuants/cache';
import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import {
  getApiV1Account,
  getApiV1TickerPrice,
  getFApiV2PositionRisk,
  getFApiV4Account,
  ICredential,
} from '../../api/private-api';
import { listProducts } from '../markets/product';

// ISSUE: ASBNB price is not available in the price API, need to fetch from coingecko
const asBNBPrice = createCache(
  () =>
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=astherus-staked-bnb&vs_currencies=usd')
      .then((res) => res.json())
      .then((data) => data['astherus-staked-bnb'].usd as number),
  {
    expire: 60_000, // 1 minute
  },
);

const spotProductMapCache = createCache(
  async () => {
    const products = await listProducts();
    const map = new Map<string, string>();
    for (const product of products) {
      const [, instType] = product.product_id.split('/');
      if (instType === 'SPOT') {
        map.set(product.base_currency, product.product_id);
      }
    }
    return map;
  },
  { expire: 86_400_000 },
);

export const getPositions = async (credential: ICredential) => {
  const positions: IPosition[] = [];
  const [x, prices, prep, positionRisk, spotProductMap] = await Promise.all([
    getApiV1Account(credential, {}),
    getApiV1TickerPrice(credential, {}),
    getFApiV4Account(credential, {}),
    getFApiV2PositionRisk(credential, {}),
    spotProductMapCache.query(''),
  ]);

  const resolvedSpotProductMap = spotProductMap ?? new Map<string, string>();

  for (const b of x.balances) {
    const thePrice = b.asset === 'USDT' ? 1 : prices.find((p) => p.symbol === b.asset + 'USDT')?.price ?? 0;
    positions.push(
      makeSpotPosition({
        position_id: b.asset,
        datasource_id: 'ASTER',
        product_id: resolvedSpotProductMap.get(b.asset) ?? encodePath('ASTER', 'SPOT', b.asset),
        volume: +b.free + +b.locked,
        free_volume: +b.free,
        closable_price: +thePrice,
      }),
    );
  }

  for (const b of prep.assets) {
    if (+b.walletBalance === 0) continue;
    let thePrice = 0;
    if (b.asset === 'USDT') {
      thePrice = 1;
    } else if (b.asset === 'ASBNB') {
      const _p = await asBNBPrice.query('').catch(() => 0);
      if (_p) {
        thePrice = _p;
      }
    } else {
      thePrice = +(prices.find((p) => p.symbol === b.asset + 'USDT')?.price ?? 0);
    }

    positions.push(
      makeSpotPosition({
        position_id: encodePath(b.asset, 'ASSET'),
        datasource_id: 'ASTER',
        product_id: encodePath('ASTER', 'PERP-ASSET', b.asset),
        volume: +b.walletBalance,
        free_volume: +b.walletBalance,
        closable_price: thePrice,
      }),
    );
  }

  for (const p of prep.positions) {
    if (+p.positionAmt === 0) continue;
    positions.push({
      position_id: p.symbol,
      product_id: encodePath('ASTER', 'PERP', p.symbol),
      datasource_id: 'ASTER',
      direction: p.positionSide === 'BOTH' ? (+p.positionAmt > 0 ? 'LONG' : 'SHORT') : p.positionSide,
      volume: Math.abs(+p.positionAmt),
      free_volume: Math.abs(+p.positionAmt),
      position_price: +p.entryPrice,
      closable_price: Math.abs(+p.notional / +p.positionAmt),
      floating_profit: +p.unrealizedProfit,
      // TODO: optimize find performance
      liquidation_price: positionRisk.find((r) => r.symbol === p.symbol)?.liquidationPrice,
      valuation: Math.abs(+p.notional),
    });
  }

  return positions;
};
