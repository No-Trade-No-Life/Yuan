export const mapBitgetOrderToOrderType = (order: { orderType?: string; timeInForce?: string }) => {
  if (order.timeInForce === 'post_only') return 'MAKER';
  if (order.timeInForce === 'ioc') return 'IOC';
  if (order.timeInForce === 'fok') return 'FOK';
  if (order.orderType === 'market') return 'MARKET';
  if (order.orderType === 'limit') return 'LIMIT';
  return 'UNKNOWN';
};
