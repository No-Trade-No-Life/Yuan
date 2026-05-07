import { refreshSnapshotBudget } from '../domain/evaluate-budget';
import { EventSourcedTradingState, QueryProjectionRequest } from '../types/snapshot';

const round = (value: number) => Math.round(value * 1_000_000_000) / 1_000_000_000;

export const queryProjection = (state: EventSourcedTradingState, query: QueryProjectionRequest) => {
  const snapshot = refreshSnapshotBudget(state.snapshot, state.clock_ms);
  switch (query.type) {
    case 'subscription':
      return snapshot.subscriptions[query.subscription_id];
    case 'investor': {
      const subscriptions = Object.values(snapshot.subscriptions)
        .filter((subscription) => subscription.investor_id === query.investor_id)
        .sort((left, right) => left.subscription_id.localeCompare(right.subscription_id));
      if (subscriptions.length === 0) return undefined;
      return {
        investor_id: query.investor_id,
        subscription_ids: subscriptions.map((item) => item.subscription_id),
        active_subscription_ids: subscriptions
          .filter((item) => item.status === 'active')
          .map((item) => item.subscription_id),
        subscription_count: subscriptions.length,
        active_subscription_count: subscriptions.filter((item) => item.status === 'active').length,
        total_released_vc: round(subscriptions.reduce((sum, item) => sum + item.released_vc_total, 0)),
        total_available_vc: round(subscriptions.reduce((sum, item) => sum + item.available_vc, 0)),
        total_funding_account: round(subscriptions.reduce((sum, item) => sum + item.funding_account, 0)),
        total_trading_account: round(subscriptions.reduce((sum, item) => sum + item.trading_account, 0)),
        total_precision_locked_amount: round(
          subscriptions.reduce((sum, item) => sum + item.precision_locked_amount, 0),
        ),
        total_target_position_qty: round(
          subscriptions.reduce((sum, item) => sum + item.target_position_qty, 0),
        ),
        total_settled_position_qty: round(
          subscriptions.reduce((sum, item) => sum + item.settled_position_qty, 0),
        ),
      };
    }
    case 'product':
      return snapshot.products[query.product_id];
    case 'signal': {
      const subscriptions = Object.values(snapshot.subscriptions)
        .filter((subscription) => subscription.signal_key === query.signal_key)
        .sort((left, right) => left.subscription_id.localeCompare(right.subscription_id));
      if (subscriptions.length === 0) return undefined;
      return {
        signal_key: query.signal_key,
        subscription_ids: subscriptions.map((item) => item.subscription_id),
        product_ids: [...new Set(subscriptions.map((item) => item.product_id))].sort(),
        subscription_count: subscriptions.length,
        active_subscription_count: subscriptions.filter((item) => item.status === 'active').length,
        total_released_vc: round(subscriptions.reduce((sum, item) => sum + item.released_vc_total, 0)),
        total_available_vc: round(subscriptions.reduce((sum, item) => sum + item.available_vc, 0)),
        total_funding_account: round(subscriptions.reduce((sum, item) => sum + item.funding_account, 0)),
        total_trading_account: round(subscriptions.reduce((sum, item) => sum + item.trading_account, 0)),
        total_precision_locked_amount: round(
          subscriptions.reduce((sum, item) => sum + item.precision_locked_amount, 0),
        ),
        total_target_position_qty: round(
          subscriptions.reduce((sum, item) => sum + item.target_position_qty, 0),
        ),
        total_settled_position_qty: round(
          subscriptions.reduce((sum, item) => sum + item.settled_position_qty, 0),
        ),
      };
    }
    case 'audit_by_signal_id':
      return snapshot.audit_by_signal_id[query.signal_id];
    case 'audit_by_subscription_id':
      return snapshot.audit_by_subscription_id[query.subscription_id];
    case 'audit_by_order_id':
      return snapshot.audit_by_order_id[query.order_id];
    case 'reconciliation':
      return snapshot.reconciliation[query.account_id];
  }
};
