import { IOrder } from '@yuants/protocol';
import { useAgent } from '.';

/**
 * 使用本地撮合交易所 API
 * @public
 */
export const useExchange = (): {
  getQuote: (product_id: string) => { ask: number; bid: number };
  getOrderById: (orderId: string) => IOrder | undefined;
  listOrders: () => IOrder[];
  submitOrder: (...orders: IOrder[]) => void;
  cancelOrder: (...orderIds: string[]) => void;
} => {
  const agent = useAgent();
  return {
    getQuote: (product_id: string) =>
      agent.orderMatchingUnit.quoteDataUnit.mapProductIdToQuote[product_id] || { ask: NaN, bid: NaN },
    getOrderById: (orderId: string) => agent.orderMatchingUnit.getOrderById(orderId),

    listOrders: () => {
      return agent.orderMatchingUnit.listOrders();
    },
    submitOrder: (...orders) => {
      agent.orderMatchingUnit.submitOrder(...orders);
    },
    cancelOrder: (...orderIds) => {
      agent.orderMatchingUnit.cancelOrder(...orderIds);
    },
  };
};
