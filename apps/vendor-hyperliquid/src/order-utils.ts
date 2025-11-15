import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { getAllMids, getPerpetualsMetaData, getSpotMetaData } from './api/public-api';

const enum InstrumentType {
  PERPETUAL = 'PERPETUAL',
  SPOT = 'SPOT',
}

type AssetInfo = { assetId: number; szDecimals: number; instType: InstrumentType; baseCurrency: string };

let perpMetaCache:
  | { expires_at: number; map: Map<string, { assetId: number; szDecimals: number }> }
  | undefined;
let spotMetaCache:
  | { expires_at: number; map: Map<string, { assetId: number; szDecimals: number }> }
  | undefined;
let midPriceCache: { expires_at: number; map: Map<string, number> } | undefined;

const CACHE_TTL = 60_000;
const MID_TTL = 5_000;

const ensurePerpMeta = async () => {
  if (!perpMetaCache || perpMetaCache.expires_at < Date.now()) {
    const meta = await getPerpetualsMetaData();
    const map = new Map<string, { assetId: number; szDecimals: number }>();
    meta.universe.forEach((token, index) =>
      map.set(token.name, { assetId: index, szDecimals: token.szDecimals }),
    );
    perpMetaCache = { map, expires_at: Date.now() + CACHE_TTL };
  }
  return perpMetaCache.map;
};

const ensureSpotMeta = async () => {
  if (!spotMetaCache || spotMetaCache.expires_at < Date.now()) {
    const meta = await getSpotMetaData();
    const map = new Map<string, { assetId: number; szDecimals: number }>();
    meta.tokens.forEach((token) =>
      map.set(token.name, { assetId: token.index, szDecimals: token.szDecimals }),
    );
    spotMetaCache = { map, expires_at: Date.now() + CACHE_TTL };
  }
  return spotMetaCache.map;
};

const ensureMidPrices = async () => {
  if (!midPriceCache || midPriceCache.expires_at < Date.now()) {
    const mids = await getAllMids();
    const map = new Map<string, number>();
    for (const [coin, price] of Object.entries(mids ?? {})) {
      const value = Number(price);
      if (Number.isFinite(value)) {
        map.set(coin, value);
      }
    }
    midPriceCache = { map, expires_at: Date.now() + MID_TTL };
  }
  return midPriceCache.map;
};

export const resolveAssetInfo = async (product_id: string): Promise<AssetInfo> => {
  const [instType, symbol] = decodePath(product_id);
  if (!instType || !symbol) {
    throw new Error(`Invalid product_id: ${product_id}`);
  }
  const baseCurrency = symbol.split('-')[0];
  if (instType === InstrumentType.PERPETUAL) {
    const map = await ensurePerpMeta();
    const info = map.get(baseCurrency);
    if (!info) {
      throw new Error(`Unable to resolve Hyperliquid asset id for ${baseCurrency}`);
    }
    return { ...info, instType: InstrumentType.PERPETUAL, baseCurrency };
  }
  if (instType === InstrumentType.SPOT) {
    const map = await ensureSpotMeta();
    const info = map.get(baseCurrency);
    if (!info) {
      throw new Error(`Unable to resolve Hyperliquid spot asset id for ${baseCurrency}`);
    }
    return { ...info, instType: InstrumentType.SPOT, baseCurrency };
  }
  throw new Error(`Unsupported instrument type: ${instType}`);
};

export const roundPrice = (price: number, instType: 'PERPETUAL' | 'SPOT', szDecimals: number): string => {
  const MAX_DECIMALS = instType === 'PERPETUAL' ? 6 : 8;
  const maxDecimalPlaces = Math.max(0, MAX_DECIMALS - szDecimals);
  if (!Number.isFinite(price)) {
    throw new Error(`Invalid price: ${price}`);
  }
  if (Number.isInteger(price)) {
    return price.toString();
  }
  const priceStr = price.toString();
  const significantFigures = priceStr.replace(/^0+\.?0*/, '').replace(/\./g, '').length;
  let roundedPrice = price;
  if (significantFigures > 5) {
    const decimalIndex = priceStr.indexOf('.');
    if (decimalIndex === -1) {
      const magnitude = Math.floor(Math.log10(Math.abs(price)));
      const factor = Math.pow(10, magnitude - 4);
      roundedPrice = Math.round(price / factor) * factor;
    } else {
      const beforeDecimal = priceStr.substring(0, decimalIndex);
      const afterDecimal = priceStr.substring(decimalIndex + 1);
      if (beforeDecimal !== '0') {
        const integerDigits = beforeDecimal.replace('-', '').length;
        const neededDecimalDigits = Math.max(0, 5 - integerDigits);
        roundedPrice = parseFloat(price.toFixed(neededDecimalDigits));
      } else {
        const leadingZeros = afterDecimal.match(/^0*/)?.[0].length ?? 0;
        const precision = leadingZeros + 5;
        roundedPrice = parseFloat(price.toFixed(precision));
      }
    }
  }
  const finalPrice = parseFloat(roundedPrice.toFixed(maxDecimalPlaces));
  return finalPrice.toString();
};

const resolvePrice = async (
  order: IOrder,
  instType: 'PERPETUAL' | 'SPOT',
  szDecimals: number,
  baseCurrency: string,
) => {
  if (order.order_type === 'MARKET') {
    const mid = await getMidPriceWithSlippage(
      baseCurrency,
      order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT',
    );
    return roundPrice(mid, instType, szDecimals);
  }
  if (!order.price) {
    throw new Error('price is required for non-market orders');
  }
  return roundPrice(+order.price, instType, szDecimals);
};

export const buildOrderPayload = async (order: IOrder) => {
  const assetInfo = await resolveAssetInfo(order.product_id);
  const isBuy = order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT';
  const reduceOnly = order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT';
  const price = await resolvePrice(order, assetInfo.instType, assetInfo.szDecimals, assetInfo.baseCurrency);
  const tif = order.order_type === 'MARKET' ? 'Ioc' : order.order_type === 'MAKER' ? 'Alo' : 'Gtc';
  return {
    assetInfo,
    orderParams: {
      a: assetInfo.assetId,
      b: isBuy,
      p: `${price}`,
      s: `${order.volume}`,
      r: reduceOnly,
      t: { limit: { tif } },
    },
  };
};

export const getMidPriceWithSlippage = async (coin: string, isBuy: boolean) => {
  const mids = await ensureMidPrices();
  const mid = mids.get(coin);
  if (!mid) {
    throw new Error(`Unable to resolve Hyperliquid mid price for ${coin}`);
  }
  const slippage = isBuy ? 1.05 : 0.95;
  return mid * slippage;
};
