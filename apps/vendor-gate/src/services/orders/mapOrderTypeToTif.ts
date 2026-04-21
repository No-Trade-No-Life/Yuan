export const mapOrderTypeToTif = (orderType?: string): string => {
  if (orderType === 'MARKET') return 'ioc';
  if (orderType === 'LIMIT' || orderType === 'MAKER') return 'gtc';
  if (orderType === 'IOC') return 'ioc';
  if (orderType === 'FOK') return 'fok';
  throw new Error(`Unsupported order_type: ${orderType}`);
};
