import { IOrder } from '@yuants/data-order';

export const mapHuobiSwapOrderToOrderType = (orderPriceType?: string): IOrder['order_type'] => {
  if (orderPriceType === 'lightning' || orderPriceType === 'market') return 'MARKET';
  if (orderPriceType === 'fok') return 'FOK';
  if (orderPriceType?.includes('ioc')) return 'IOC';
  return 'LIMIT';
};
