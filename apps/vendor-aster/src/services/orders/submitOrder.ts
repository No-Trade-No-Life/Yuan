import { IActionHandlerOfSubmitOrder } from '@yuants/data-order';
import { decodePath, roundToStep } from '@yuants/utils';
import { getApiV1TickerPrice, ICredential, postApiV1Order, postFApiV1Order } from '../../api/private-api';

const parseProductId = (productId?: string) => {
  if (!productId) {
    return { category: undefined as string | undefined, symbol: undefined as string | undefined };
  }
  const parts = decodePath(productId);
  if (parts.length >= 3) {
    return { category: parts[1], symbol: parts.slice(2).join('/') };
  }
  return { category: undefined, symbol: parts[0] };
};

const handleSubmitOrderOfSpot: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const { symbol } = parseProductId(order.product_id);
  const resolvedSymbol = symbol ?? order.product_id;
  if (!resolvedSymbol) {
    throw new Error(`Invalid product_id: unable to resolve spot symbol from "${order.product_id}"`);
  }

  const type = ({ MARKET: 'MARKET', LIMIT: 'LIMIT', MAKER: 'LIMIT' } as const)[order.order_type!];
  if (!type) throw new Error(`Unsupported order_type: ${order.order_type}`);

  const side = ({ OPEN_LONG: 'BUY', OPEN_SHORT: 'SELL', CLOSE_LONG: 'SELL', CLOSE_SHORT: 'BUY' } as const)[
    order.order_direction!
  ];
  if (!side) throw new Error(`Unsupported order_direction: ${order.order_direction}`);

  const timeInForce = order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;

  const price = order.price;

  let quantity: number | undefined = order.volume;
  let quoteOrderQty: number | undefined;

  if (type === 'MARKET' && side === 'BUY') {
    const spotPrice = await getApiV1TickerPrice(credential, {});
    const thePrice = spotPrice.find((x) => x.symbol === resolvedSymbol)?.price;
    if (!thePrice) throw new Error(`Cannot get price for symbol ${resolvedSymbol}`);
    quantity = undefined;
    quoteOrderQty = roundToStep(order.volume * +thePrice, 0.01);
  }

  const res = await postApiV1Order(credential, {
    symbol: resolvedSymbol,
    type,
    side,
    timeInForce,
    price,
    quantity,
    quoteOrderQty,
  });

  if (!res.orderId) {
    throw new Error('Failed to retrieve order ID from response');
  }

  return { order_id: '' + res.orderId };
};

const handleSubmitOrderOfPerp: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const { symbol } = parseProductId(order.product_id);
  if (!symbol) {
    throw new Error(`Invalid product_id: unable to decode symbol from "${order.product_id}"`);
  }

  const side = ({ OPEN_LONG: 'BUY', OPEN_SHORT: 'SELL', CLOSE_LONG: 'SELL', CLOSE_SHORT: 'BUY' } as const)[
    order.order_direction!
  ];
  if (!side) throw new Error(`Unsupported order_direction: ${order.order_direction}`);

  const type = ({ MARKET: 'MARKET', LIMIT: 'LIMIT', MAKER: 'LIMIT' } as const)[order.order_type!];
  if (!type) throw new Error(`Unsupported order_type: ${order.order_type}`);

  const quantity = order.volume;
  const price = order.price;

  const isPositionSingleSide = true; // FIXME: Aster 永续合约仅支持单向持仓模式

  const positionSide = isPositionSingleSide
    ? undefined
    : order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG'
    ? 'LONG'
    : order.order_direction === 'OPEN_SHORT' || order.order_direction === 'CLOSE_SHORT'
    ? 'SHORT'
    : undefined;

  const reduceOnly =
    order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'true' : undefined;

  const timeInForce = order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;

  //
  const res = await postFApiV1Order(credential, {
    symbol,
    side,
    type,
    quantity,
    price,
    timeInForce,
    positionSide,
    reduceOnly,
  });

  const orderId =
    (res as any)?.orderId ??
    (res as any)?.order_id ??
    (res as any)?.data?.orderId ??
    (res as any)?.data?.order_id;

  if (!orderId) throw new Error('Failed to retrieve order ID from response');

  return { order_id: `${orderId}` };
};

export const handleSubmitOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const [_, instType] = decodePath(order.product_id); // BITGET/USDT-FUTURES/BTCUSDT
  if (instType === 'SPOT') {
    return handleSubmitOrderOfSpot(credential, order);
  }
  if (instType === 'PERP') {
    return handleSubmitOrderOfPerp(credential, order);
  }
  throw new Error(`Unsupported account_id for SubmitOrder: ${order.account_id}`);
};
