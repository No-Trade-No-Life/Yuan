import { IOrder } from '@yuants/data-order';
import { StrategyAction } from './types';

/**
 * 生成订单的唯一标识键
 * 使用高效的字符串拼接替代 JSON.stringify
 */
function getOrderKey(order: IOrder): string {
  return `${order.account_id}|${order.product_id}|${order.order_direction}|${order.price}|${order.volume}`;
}

/**
 * 计算订单实例数组映射
 * 使用 Map 存储所有匹配的订单实例，确保撤单时能返回正确的 order_id
 * 直接使用数组长度作为计数，避免冗余的 counts map
 */
function computeOrderInstances(orders: IOrder[]): Map<string, IOrder[]> {
  const instances = new Map<string, IOrder[]>();

  for (const order of orders) {
    const key = getOrderKey(order);
    if (!instances.has(key)) {
      instances.set(key, []);
    }
    instances.get(key)!.push(order);
  }

  return instances;
}

/**
 * 协调当前订单和目标订单，返回需要执行的动作序列
 *
 * 安全策略：如果有需要撤单的订单，这一轮只撤单，不执行下单
 * 避免并发执行撤单和下单可能造成的多余头寸
 *
 * 优化说明：
 * - 使用 Map<string, IOrder[]> 存储所有匹配的订单实例
 * - 直接使用数组长度作为计数，避免冗余的 counts map
 * - 撤单时返回具体的订单实例，确保每个撤单动作都有正确的 order_id
 * - 下单时使用第一个订单实例作为模板，因为目标订单没有 order_id
 */
export function reconcileOrders(currentOrders: IOrder[], targetOrders: IOrder[]): StrategyAction[] {
  // 计算订单实例映射，直接使用数组长度作为计数（优化：移除冗余的 counts map）
  const currentInstances = computeOrderInstances(currentOrders);
  const targetInstances = computeOrderInstances(targetOrders);

  // 计算需要撤单的订单
  const ordersToCancel: IOrder[] = [];

  for (const [orderKey, currentOrderInstances] of currentInstances) {
    const currentCount = currentOrderInstances.length;
    const targetCount = targetInstances.get(orderKey)?.length || 0;
    const cancelCount = currentCount - targetCount;

    if (cancelCount > 0) {
      // 取出需要撤单的具体订单实例，确保每个撤单动作都有正确的 order_id
      for (let i = 0; i < cancelCount; i++) {
        ordersToCancel.push(currentOrderInstances[i]);
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

  for (const [orderKey, targetOrderInstances] of targetInstances) {
    const targetCount = targetOrderInstances.length;
    const currentCount = currentInstances.get(orderKey)?.length || 0;
    const submitCount = targetCount - currentCount;

    if (submitCount > 0) {
      // 使用第一个订单实例作为下单模板，因为目标订单没有 order_id
      const order = targetOrderInstances[0];
      // 直接添加需要下单的数量
      for (let i = 0; i < submitCount; i++) {
        ordersToSubmit.push(order);
      }
    }
  }

  // 执行下单
  return ordersToSubmit.map((order) => ({
    type: 'SubmitOrder' as const,
    payload: order,
  }));
}
