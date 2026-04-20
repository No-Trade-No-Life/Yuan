export const mapOrderTypeToOrdType = (orderType?: string) => {
  switch (orderType) {
    case 'LIMIT':
      return 'limit';
    case 'MARKET':
      return 'market';
    case 'MAKER':
      return 'post_only';
    case 'IOC':
      return 'ioc';
    case 'FOK':
      return 'fok';
  }

  throw new Error(`Unknown order type: ${orderType}`);
};
