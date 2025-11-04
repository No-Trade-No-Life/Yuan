import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

/**
 * Round price according to Hyperliquid rules:
 * - Max 5 significant figures
 * - Max decimal places = MAX_DECIMALS - szDecimals (6 for perps, 8 for spot)
 * - Integer prices are always allowed regardless of significant figures
 */
const roundPrice = (price: number, instType: 'PERPETUAL' | 'SPOT', szDecimals: number): string => {
  const MAX_DECIMALS = instType === 'PERPETUAL' ? 6 : 8;
  const maxDecimalPlaces = MAX_DECIMALS - szDecimals;

  // Convert to string to work with precision
  const priceStr = price.toString();

  // Check if it's an integer
  if (Number.isInteger(price)) {
    return priceStr;
  }

  // Get significant figures count
  const significantFigures = priceStr.replace(/^0+\.?0*/, '').replace(/\./g, '').length;

  // If more than 5 significant figures, round to 5
  let roundedPrice = price;
  if (significantFigures > 5) {
    // Find the position of the first non-zero digit
    const firstNonZeroIndex = priceStr.match(/[1-9]/)?.index || 0;
    const decimalIndex = priceStr.indexOf('.');

    if (decimalIndex === -1) {
      // Integer case - round to 5 significant figures
      const magnitude = Math.floor(Math.log10(Math.abs(price)));
      const factor = Math.pow(10, magnitude - 4); // 5 significant figures
      roundedPrice = Math.round(price / factor) * factor;
    } else {
      // Decimal case
      const beforeDecimal = priceStr.substring(0, decimalIndex);
      const afterDecimal = priceStr.substring(decimalIndex + 1);

      if (beforeDecimal !== '0') {
        // Has integer part
        const integerDigits = beforeDecimal.length;
        const neededDecimalDigits = Math.max(0, 5 - integerDigits);
        roundedPrice = parseFloat(price.toFixed(neededDecimalDigits));
      } else {
        // Pure decimal (0.xxxx)
        const leadingZeros = afterDecimal.match(/^0*/)?.[0].length || 0;
        const precision = leadingZeros + 5;
        roundedPrice = parseFloat(price.toFixed(precision));
      }
    }
  }

  // Apply decimal places limit
  const finalPrice = parseFloat(roundedPrice.toFixed(maxDecimalPlaces));

  return finalPrice.toString();
};

terminal.server.provideService<IOrder, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id'],
    properties: {
      account_id: { const: `Hyperliquid/${client.public_key}` },
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(msg));
    const order = msg.req;

    const [instType, symbol] = order.product_id.split('/');
    const baseCurrency = symbol.split('-')[0];

    const mapBaseCurrencyToAssetId: Record<string, number> = {};
    const mapBaseCurrencyToSzDecimals: Record<string, number> = {};

    if (instType === 'PERPETUAL') {
      const meta = await client.getPerpetualsMetaData();
      for (let i = 0; i < meta.universe.length; i++) {
        const token = meta.universe[i];
        mapBaseCurrencyToAssetId[token.name] = i;
        mapBaseCurrencyToSzDecimals[token.name] = token.szDecimals;
      }
    } else if (instType === 'SPOT') {
      const meta = await client.getSpotMetaData();
      for (const token of meta.tokens) {
        mapBaseCurrencyToAssetId[token.name] = token.index;
        mapBaseCurrencyToSzDecimals[token.name] = token.szDecimals;
      }
    }

    const a = mapBaseCurrencyToAssetId[baseCurrency];
    const szDecimals = mapBaseCurrencyToSzDecimals[baseCurrency];
    const b = order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT';

    let price = `${order.price}`;
    if (order.order_type === 'MARKET') {
      const allMids = await client.getAllMids();
      const midPrice = +allMids[baseCurrency];
      price = `${b ? (1 + 0.05) * midPrice : (1 - 0.05) * midPrice}`;
    }
    price = roundPrice(+price, instType as 'PERPETUAL' | 'SPOT', szDecimals);

    const p = `${price}`;
    const s = `${order.volume}`;
    const r = order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT';
    // other method
    const tif = order.order_type === 'MARKET' ? 'Ioc' : order.order_type === 'MAKER' ? 'Alo' : 'Gtc';
    const t = {
      limit: {
        tif,
      },
    };
    const params = {
      orders: [
        {
          a,
          b,
          p,
          s,
          r,
          t,
        },
      ],
    };

    const res = await client.placeOrder(params);
    console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(res));
    const status = res.response?.data?.statuses?.[0];
    const orderId =
      status?.resting?.oid ?? status?.filled?.oid ?? (status as any)?.oid ?? (status as any)?.orderId;
    return {
      res: {
        code: res.status === 'ok' && res.response.data.statuses[0]?.error === undefined ? 0 : 1,
        message: res.status !== 'ok' ? 'API ERROR' : res.response.data.statuses[0]?.error || 'OK',
        data: orderId !== undefined ? { order_id: `${orderId}` } : undefined,
      },
    };
  },
);

const assetIdMap: { value?: Map<string, number> } = {};
const getAssetIdMap = async () => {
  if (!assetIdMap.value) {
    const meta = await client.getPerpetualsMetaData();
    const map = new Map<string, number>();
    meta.universe.forEach((token, index) => {
      map.set(token.name, index);
    });
    assetIdMap.value = map;
  }
  return assetIdMap.value;
};

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      account_id: { const: `Hyperliquid/${client.public_key}` },
      order_id: { type: ['string', 'number'] },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const order = msg.req;
    if (!order.order_id) {
      throw new Error('order_id is required for CancelOrder');
    }

    const [instType, symbol] = decodePath(order.product_id);
    if (instType !== 'PERPETUAL') {
      throw new Error(`Unsupported instrument type for cancel: ${instType}`);
    }
    const baseCurrency = symbol.split('-')[0];
    const assetId =
      (() => {
        try {
          if (order.comment) {
            const parsed = JSON.parse(order.comment);
            if (typeof parsed?.asset_id === 'number') {
              return parsed.asset_id;
            }
          }
        } catch {
          // ignore parse error
        }
        return undefined;
      })() ?? (await getAssetIdMap()).get(baseCurrency);

    if (assetId === undefined) {
      throw new Error(`Unable to resolve asset id for ${baseCurrency}`);
    }

    const orderId = Number(order.order_id);
    if (!Number.isFinite(orderId)) {
      throw new Error(`Invalid order_id: ${order.order_id}`);
    }

    const res = await client.cancelOrder({
      cancels: [
        {
          a: assetId,
          o: orderId,
        },
      ],
    });
    const error =
      res.status !== 'ok'
        ? 'API ERROR'
        : Array.isArray(res.response?.data?.statuses) && typeof res.response.data.statuses[0] !== 'string'
        ? res.response.data.statuses[0]?.error
        : undefined;

    return {
      res: {
        code: error ? 1 : 0,
        message: error || 'OK',
      },
    };
  },
);
