export const mapOkxOrdTypeToOrderType = (ordType?: string) => {
  switch (ordType) {
    case 'market':
      return 'MARKET';
    case 'limit':
      return 'LIMIT';
    case 'post_only':
      return 'MAKER';
    case 'ioc':
      return 'IOC';
    case 'fok':
      return 'FOK';
    default:
      return 'UNKNOWN';
  }
};
