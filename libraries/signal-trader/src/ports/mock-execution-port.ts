import { IOrder } from '@yuants/data-order';
import { ExecutionPort } from './execution-port';

export interface CreateMockExecutionPortOptions<C = unknown> {
  get_credential_key: (credential: C) => string;
  seed?: {
    orders?: Record<string, IOrder[]>;
    positions?: Record<string, unknown[]>;
  };
}

export const createMockExecutionPort = <C = unknown>(
  options: CreateMockExecutionPortOptions<C>,
): ExecutionPort<C> => {
  if (process.env.NODE_ENV !== 'test' && process.env.SIGNAL_TRADER_ALLOW_UNSAFE_MOCK !== 'true') {
    throw new Error('MOCK_EXECUTION_PORT_DISABLED');
  }

  const orders = new Map<string, IOrder[]>(Object.entries(options.seed?.orders ?? {}));
  const positions = new Map<string, unknown[]>(Object.entries(options.seed?.positions ?? {}));

  const getOrdersBucket = (credential: C) => {
    const key = options.get_credential_key(credential);
    const current = orders.get(key) ?? [];
    orders.set(key, current);
    return current;
  };

  const getPositionsBucket = (credential: C) => {
    const key = options.get_credential_key(credential);
    const current = positions.get(key) ?? [];
    positions.set(key, current);
    return current;
  };

  return {
    getPositions: async (credential: C) => [...getPositionsBucket(credential)] as any,
    getOrders: async (credential: C) => [...getOrdersBucket(credential)],
    getPositionsByProductId: async (credential: C, product_id: string) =>
      getPositionsBucket(credential).filter((item: any) => item.product_id === product_id) as any,
    getOrdersByProductId: async (credential: C, product_id: string) =>
      getOrdersBucket(credential).filter((item) => item.product_id === product_id),
    submitOrder: async (credential: C, order: IOrder) => {
      const bucket = getOrdersBucket(credential);
      const order_id = order.order_id ?? `MOCK-${bucket.length + 1}`;
      bucket.push({ ...order, order_id, order_status: 'ACCEPTED' });
      return { order_id };
    },
    modifyOrder: async (credential: C, order: IOrder) => {
      const bucket = getOrdersBucket(credential);
      const index = bucket.findIndex((item) => item.order_id === order.order_id);
      if (index >= 0) {
        bucket[index] = { ...bucket[index], ...order };
      }
    },
    cancelOrder: async (credential: C, order: IOrder) => {
      const bucket = getOrdersBucket(credential);
      const index = bucket.findIndex((item) => item.order_id === order.order_id);
      if (index >= 0) {
        bucket[index] = { ...bucket[index], order_status: 'CANCELLED' };
      }
    },
  };
};
