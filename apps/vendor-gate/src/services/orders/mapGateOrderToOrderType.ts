export const mapGateOrderToOrderType = (order: { tif?: string; price?: string }) => {
  if (order.tif === 'fok') return 'FOK';
  if (order.tif === 'ioc') {
    return Number(order.price) === 0 ? 'MARKET' : 'IOC';
  }
  return undefined;
};
