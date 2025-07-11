import { formatTime } from '@yuants/utils';
import { client } from './api';
import { terminal } from './terminal';

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

terminal.provideService(
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
    const t =
      order.order_type === 'MARKET'
        ? {
            limit: {
              tif: 'Ioc',
            },
          }
        : {
            limit: {
              tif: 'Gtc',
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
    return {
      res: {
        code: res.status === 'ok' && res.response.data.statuses[0]?.error === undefined ? 0 : 1,
        message: res.status !== 'ok' ? 'API ERROR' : res.response.data.statuses[0]?.error || 'OK',
      },
    };
  },
);
