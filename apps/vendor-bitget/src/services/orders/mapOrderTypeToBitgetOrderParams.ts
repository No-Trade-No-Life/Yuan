export const mapOrderTypeToBitgetOrderParams = (orderType?: string) => {
  if (orderType === 'MARKET') return { orderType: 'market' };
  if (orderType === 'LIMIT') return { orderType: 'limit' };
  if (orderType === 'MAKER') return { orderType: 'limit', timeInForce: 'post_only' };
  if (orderType === 'IOC') return { orderType: 'limit', timeInForce: 'ioc' };
  if (orderType === 'FOK') return { orderType: 'limit', timeInForce: 'fok' };
  throw new Error(`Unsupported order_type: ${orderType}`);
};
