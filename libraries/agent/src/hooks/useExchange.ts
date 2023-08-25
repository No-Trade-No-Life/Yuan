import { IOrder } from '@yuants/protocol';
import { useAgent } from '.';

/**
 * 使用本地撮合交易所 API
 * @public
 */
export const useExchange = (): {
  listOrders: () => IOrder[];
  submitOrder: (...orders: IOrder[]) => void;
  cancelOrder: (...orderIds: string[]) => void;
} => {
  const agent = useAgent();
  return {
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
