import { IOrder } from '@yuants/data-order';
import { IExchange } from '@yuants/exchange';
import {
  CancelOrderEffectPayload,
  ModifyOrderEffectPayload,
  PlaceOrderEffectPayload,
  PlannedEffect,
} from '../types/snapshot';

export type ExecutionPort<C = unknown> = Pick<
  IExchange<C>,
  | 'getPositions'
  | 'getOrders'
  | 'getPositionsByProductId'
  | 'getOrdersByProductId'
  | 'submitOrder'
  | 'modifyOrder'
  | 'cancelOrder'
>;

export interface ApplyExecutionScope<C = unknown> {
  authorize_order(ctx: {
    credential: C;
    effect: PlaceOrderEffectPayload | ModifyOrderEffectPayload | CancelOrderEffectPayload;
  }): { account_id: string } | Promise<{ account_id: string }>;
}

export interface AppliedEffectResult {
  effect: PlannedEffect;
  account_id: string;
  external_order_id?: string;
}

const toOrder = (account_id: string, effect: PlannedEffect): IOrder => {
  switch (effect.effect_type) {
    case 'place_order':
      return {
        order_id: effect.order_id,
        account_id,
        product_id: effect.product_id,
        order_type: 'MARKET',
        volume: Math.abs(effect.size),
        size: `${effect.size}`,
        stop_loss_price: effect.stop_loss_price,
      };
    case 'modify_order':
      return {
        order_id: effect.order_id,
        account_id,
        product_id: effect.product_id,
        volume: Math.abs(effect.next_size),
        size: `${effect.next_size}`,
      };
    case 'cancel_order':
      return {
        order_id: effect.order_id,
        account_id,
        product_id: effect.product_id,
        volume: 0,
      };
  }
};

export const applyExecutionEffects = async <C>(
  port: ExecutionPort<C>,
  credential: C,
  planned_effects: PlannedEffect[],
  scope?: ApplyExecutionScope<C>,
): Promise<AppliedEffectResult[]> => {
  if (!scope?.authorize_order) {
    throw new Error('AUTHORIZE_ORDER_REQUIRED');
  }

  const results: AppliedEffectResult[] = [];
  for (const effect of planned_effects) {
    const { account_id } = await scope.authorize_order({ credential, effect });
    switch (effect.effect_type) {
      case 'place_order': {
        const order = toOrder(account_id, effect);
        const { order_id } = await port.submitOrder(credential, order);
        results.push({ effect, account_id, external_order_id: order_id });
        break;
      }
      case 'modify_order': {
        await port.modifyOrder(credential, toOrder(account_id, effect));
        results.push({ effect, account_id, external_order_id: effect.order_id });
        break;
      }
      case 'cancel_order': {
        await port.cancelOrder(credential, toOrder(account_id, effect));
        results.push({ effect, account_id, external_order_id: effect.order_id });
        break;
      }
    }
  }
  return results;
};
