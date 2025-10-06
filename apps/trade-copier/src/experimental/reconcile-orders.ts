import { IOrder } from '@yuants/data-order';
import { StrategyAction } from './types';

/**
 * 生成订单的唯一标识键
 * 使用高效的字符串拼接替代 JSON.stringify
 */
function getOrderKey(order: IOrder): string {
  return `${order.account_id}|${order.product_id}|${order.order_type}|${order.order_direction}|${order.price}|${order.volume}`;
}

/**
 * 计算订单计数和实例数组映射
 * 使用 Map 替代对象，提供更好的性能和类型安全
 * 存储所有匹配的订单实例，确保撤单时能返回正确的 order_id
 */
function computeOrderMaps(orders: IOrder[]): {
  counts: Map<string, number>;
  instances: Map<string, IOrder[]>;
} {
  const counts = new Map<string, number>();
  const instances = new Map<string, IOrder[]>();

  for (const order of orders) {
    const key = getOrderKey(order);
    counts.set(key, (counts.get(key) || 0) + 1);

    // 存储所有匹配的订单实例
    if (!instances.has(key)) {
      instances.set(key, []);
    }
    instances.get(key)!.push(order);
  }

  return { counts, instances };
}

/**
 * 协调当前订单和目标订单，返回需要执行的动作序列
 *
 * 安全策略：如果有需要撤单的订单，这一轮只撤单，不执行下单
 * 避免并发执行撤单和下单可能造成的多余头寸
 */
export function reconcileOrders(currentOrders: IOrder[], targetOrders: IOrder[]): StrategyAction[] {
  // 一次性计算所有需要的计数和实例映射
  const currentMaps = computeOrderMaps(currentOrders);
  const targetMaps = computeOrderMaps(targetOrders);

  // 计算需要撤单的订单
  const ordersToCancel: IOrder[] = [];

  for (const [orderKey, currentCount] of currentMaps.counts) {
    const targetCount = targetMaps.counts.get(orderKey) || 0;
    const cancelCount = currentCount - targetCount;

    if (cancelCount > 0) {
      const orderInstances = currentMaps.instances.get(orderKey);
      if (orderInstances && orderInstances.length >= cancelCount) {
        // 取出需要撤单的具体订单实例，确保每个撤单动作都有正确的 order_id
        for (let i = 0; i < cancelCount; i++) {
          ordersToCancel.push(orderInstances[i]);
        }
      }
    }
  }

  // 如果有需要撤单的订单，这一轮只撤单
  if (ordersToCancel.length > 0) {
    return ordersToCancel.map((order) => ({
      type: 'CancelOrder' as const,
      payload: order,
    }));
  }

  // 只有在没有撤单需求时，才计算需要下单的订单
  const ordersToSubmit: IOrder[] = [];

  for (const [orderKey, targetCount] of targetMaps.counts) {
    const currentCount = currentMaps.counts.get(orderKey) || 0;
    const submitCount = targetCount - currentCount;

    if (submitCount > 0) {
      const orderInstances = targetMaps.instances.get(orderKey);
      if (orderInstances && orderInstances.length > 0) {
        // 使用第一个订单实例作为下单模板，因为目标订单没有 order_id
        const order = orderInstances[0];
        // 直接添加需要下单的数量
        for (let i = 0; i < submitCount; i++) {
          ordersToSubmit.push(order);
        }
      }
    }
  }

  // 执行下单
  return ordersToSubmit.map((order) => ({
    type: 'SubmitOrder' as const,
    payload: order,
  }));
}
