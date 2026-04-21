export const mapGateOrderToOrderType = (order: { tif?: string; price?: string }) => {
  if (order.tif === 'fok') return 'FOK';
  if (order.tif === 'ioc') {
    return Number(order.price) === 0 ? 'MARKET' : 'IOC';
  }
  // Gate does not expose enough stable data here to distinguish gtc as LIMIT vs MAKER.
  return undefined;
};
