import { createCache } from '@yuants/cache';
import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { getAllMids, getPerpetualsMetaData, getSpotMetaData } from './api/public-api';

const enum InstrumentType {
  PERPETUAL = 'PERPETUAL',
  SPOT = 'SPOT',
}

type AssetInfo = { assetId: number; szDecimals: number; instType: InstrumentType; baseCurrency: string };

const CACHE_TTL = 60_000;
const MID_TTL = 5_000;

// Create caches using createCache utility
const perpMetaCache = createCache<Map<string, { assetId: number; szDecimals: number }>>(
  async () => {
    console.info(`[Hyperliquid] Refreshing perpetual metadata cache`);
    const meta = await getPerpetualsMetaData();
    const map = new Map<string, { assetId: number; szDecimals: number }>();
    meta.universe.forEach((token, index) =>
      map.set(token.name, { assetId: index, szDecimals: token.szDecimals }),
    );
    return map;
  },
  { expire: CACHE_TTL },
);

const spotMetaCache = createCache<Map<string, { assetId: number; szDecimals: number }>>(
  async () => {
    console.info(`[Hyperliquid] Refreshing spot metadata cache`);
    const meta = await getSpotMetaData();
    const map = new Map<string, { assetId: number; szDecimals: number }>();
    meta.tokens.forEach((token) =>
      map.set(token.name, { assetId: token.index, szDecimals: token.szDecimals }),
    );
    return map;
  },
  { expire: CACHE_TTL },
);

const midPriceCache = createCache<Map<string, number>>(
  async () => {
    console.info(`[Hyperliquid] Refreshing mid price cache`);
    const mids = await getAllMids();
    const map = new Map<string, number>();
    for (const [coin, price] of Object.entries(mids ?? {})) {
      const value = Number(price);
      if (Number.isFinite(value)) {
        map.set(coin, value);
      }
    }
    return map;
  },
  { expire: MID_TTL },
);

export const resolveAssetInfo = async (product_id: string): Promise<AssetInfo> => {
  const [instType, symbol] = decodePath(product_id);
  if (!instType || !symbol) {
    throw new Error(`Invalid product_id: ${product_id}`);
  }
  const baseCurrency = symbol.split('-')[0];
  if (instType === InstrumentType.PERPETUAL) {
    const map = (await perpMetaCache.query('perp'))!;
    const info = map.get(baseCurrency)!;
    return { ...info, instType: InstrumentType.PERPETUAL, baseCurrency };
  }
  if (instType === InstrumentType.SPOT) {
    const map = (await spotMetaCache.query('spot'))!;
    const info = map.get(baseCurrency)!;
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

  // Handle significant figures (max 5)
  const priceStr = price.toString();
  const significantFigures = priceStr.replace(/^0+\.?0*/, '').replace(/\./g, '').length;

  let roundedPrice = price;
  if (significantFigures > 5) {
    // Logic to round to 5 sig figs
    // This is complex to do perfectly with just numbers, but let's try to be safe
    const magnitude = Math.floor(Math.log10(Math.abs(price)));
    // We want 5 sig figs.
    // e.g. 123456 -> 123460 (mag 5, round to 10^(5-4)=10^1)
    // e.g. 0.00123456 -> 0.0012346 (mag -3, round to 10^(-3-4)=10^-7)
    const factor = Math.pow(10, magnitude - 4);
    roundedPrice = Math.round(price / factor) * factor;
  }

  // Now format to maxDecimalPlaces without scientific notation
  // Use toFixed which returns fixed point notation
  let s = roundedPrice.toFixed(maxDecimalPlaces);
  // Remove trailing zeros and decimal point if integer
  if (s.includes('.')) {
    s = s.replace(/\.?0+$/, '');
  }
  return s;
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
  const mids = (await midPriceCache.query('mids'))!;
  const mid = mids.get(coin)!;
  const slippage = isBuy ? 1.05 : 0.95;
  return mid * slippage;
};
