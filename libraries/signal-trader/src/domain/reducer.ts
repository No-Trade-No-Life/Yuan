import { DomainEvent } from '../types/events';
import { evaluateSubscriptionBudget } from './evaluate-budget';
import {
  AuditProjection,
  InvestorBufferAccount,
  LiveTradingSnapshot,
  ProductExecutionProjection,
  ReconciliationProjection,
  SubscriptionState,
} from '../types/snapshot';

const round = (value: number) => {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
};

const createAuditProjection = (): AuditProjection => ({
  event_ids: [],
  latest_status: 'idle',
});

export const createEmptySnapshot = (): LiveTradingSnapshot => ({
  subscriptions: {},
  investor_buffers: {},
  products: {},
  orders: {},
  audit_by_signal_id: {},
  audit_by_subscription_id: {},
  audit_by_order_id: {},
  reconciliation: {},
  idempotency: {},
  mode: 'normal',
});

const appendAuditEvent = (
  index: Record<string, AuditProjection>,
  key: string | undefined,
  event_id: string,
  latest_status: string,
) => {
  if (!key) return;
  const current = index[key] ?? createAuditProjection();
  index[key] = {
    event_ids: [...current.event_ids, event_id],
    latest_status,
  };
};

const ensureInvestorBuffer = (
  investor_buffers: Record<string, InvestorBufferAccount>,
  investor_id: string,
): InvestorBufferAccount => {
  if (!investor_buffers[investor_id]) {
    investor_buffers[investor_id] = {
      investor_id,
      buffer_amount: 0,
      precision_locked_amount: 0,
      sources: [],
    };
  }
  return investor_buffers[investor_id];
};

const recalculateSubscription = (subscription: SubscriptionState) => {
  const evaluated = evaluateSubscriptionBudget(subscription, subscription.last_budget_eval_at);
  subscription.released_vc_total = evaluated.released_vc_total;
  subscription.available_vc = evaluated.available_vc;
  subscription.funding_account = evaluated.funding_account;
  subscription.trading_account = evaluated.trading_account;
  subscription.precision_locked_amount = evaluated.precision_locked_amount;
  if (!subscription.precision_locked_amount) {
    subscription.precision_lock_source_event_id = undefined;
  }
};

const markPrecisionLockSource = (subscription: SubscriptionState, event_id: string) => {
  if (subscription.precision_locked_amount > 0) {
    subscription.precision_lock_source_event_id = event_id;
  } else {
    subscription.precision_lock_source_event_id = undefined;
  }
};

const recalculateInvestorBuffers = (snapshot: LiveTradingSnapshot) => {
  const nextInvestorBuffers: Record<string, InvestorBufferAccount> = {};

  for (const subscription of Object.values(snapshot.subscriptions)) {
    const current =
      nextInvestorBuffers[subscription.investor_id] ??
      ({
        investor_id: subscription.investor_id,
        buffer_amount: 0,
        precision_locked_amount: 0,
        sources: [],
      } satisfies InvestorBufferAccount);

    current.precision_locked_amount = round(
      current.precision_locked_amount + subscription.precision_locked_amount,
    );
    current.buffer_amount = current.precision_locked_amount;
    if (subscription.precision_locked_amount > 0 && subscription.precision_lock_source_event_id) {
      current.sources.push({
        source_subscription_id: subscription.subscription_id,
        amount: subscription.precision_locked_amount,
        event_id: subscription.precision_lock_source_event_id,
        reason: 'precision_lock',
      });
    }
    nextInvestorBuffers[subscription.investor_id] = current;
  }

  snapshot.investor_buffers = nextInvestorBuffers;
};

const recalculateProducts = (snapshot: LiveTradingSnapshot) => {
  const nextProducts: Record<string, ProductExecutionProjection> = {};

  for (const subscription of Object.values(snapshot.subscriptions)) {
    const current =
      nextProducts[subscription.product_id] ??
      ({
        product_id: subscription.product_id,
        current_net_qty: 0,
        target_net_qty: 0,
        pending_order_qty: 0,
        attribution_map: {},
      } satisfies ProductExecutionProjection);

    current.current_net_qty = round(current.current_net_qty + subscription.settled_position_qty);
    current.target_net_qty = round(current.target_net_qty + subscription.target_position_qty);
    if (subscription.target_position_qty !== 0) {
      current.attribution_map[subscription.subscription_id] = subscription.target_position_qty;
    }

    nextProducts[subscription.product_id] = current;
  }

  for (const order of Object.values(snapshot.orders)) {
    const current =
      nextProducts[order.product_id] ??
      ({
        product_id: order.product_id,
        current_net_qty: 0,
        target_net_qty: 0,
        pending_order_qty: 0,
        attribution_map: {},
      } satisfies ProductExecutionProjection);

    if (['submitted', 'accepted', 'partially_filled'].includes(order.status)) {
      const remaining = round(
        order.external_order_delta - Math.sign(order.external_order_delta || 0) * order.filled_qty,
      );
      current.pending_order_qty = round(current.pending_order_qty + remaining);
    }

    nextProducts[order.product_id] = current;
  }

  snapshot.products = nextProducts;
};

const recalculateReconciliation = (snapshot: LiveTradingSnapshot) => {
  const subscriptions = Object.values(snapshot.subscriptions);
  const hasScopedSubscriptions = subscriptions.some((subscription) => !!subscription.reserve_account_ref);

  for (const key of Object.keys(snapshot.reconciliation)) {
    const current = snapshot.reconciliation[key];
    const scoped = hasScopedSubscriptions
      ? subscriptions.filter((subscription) => subscription.reserve_account_ref === key)
      : subscriptions;
    const projected_balance = round(scoped.reduce((sum, subscription) => sum + subscription.available_vc, 0));
    snapshot.reconciliation[key] = {
      ...current,
      projected_balance,
      rounded_projected_balance: projected_balance,
      difference:
        current.observed_balance === undefined
          ? undefined
          : round(current.observed_balance - projected_balance),
    };
  }
};

const allocateFill = (
  fill_qty: number,
  attribution: Array<{ subscription_id: string; target_qty: number; allocation_rank: number }>,
) => {
  const sorted = [...attribution].sort((a, b) => {
    if (a.allocation_rank !== b.allocation_rank) return a.allocation_rank - b.allocation_rank;
    return a.subscription_id.localeCompare(b.subscription_id);
  });
  const total_abs = sorted.reduce((sum, item) => sum + Math.abs(item.target_qty), 0);

  if (sorted.length === 0 || total_abs === 0) {
    return [] as Array<{ subscription_id: string; qty: number }>;
  }

  let remaining = fill_qty;
  return sorted.map((item, index) => {
    const qty =
      index === sorted.length - 1 ? remaining : round((fill_qty * Math.abs(item.target_qty)) / total_abs);
    remaining = round(remaining - qty);
    return { subscription_id: item.subscription_id, qty };
  });
};

export const applyEventToSnapshot = (snapshot: LiveTradingSnapshot, event: DomainEvent) => {
  if (event.command_fingerprint) {
    const current = snapshot.idempotency[event.idempotency_key] ?? {
      fingerprint: event.command_fingerprint,
      event_ids: [],
    };
    snapshot.idempotency[event.idempotency_key] = {
      fingerprint: current.fingerprint || event.command_fingerprint,
      event_ids: [...current.event_ids, event.event_id],
    };
  }

  snapshot.last_event_at = event.created_at;

  switch (event.event_type) {
    case 'SubscriptionUpdated': {
      const payload = event.payload;
      const previous = snapshot.subscriptions[payload.subscription_id];
      const carried_release = previous
        ? Math.min(
            payload.vc_budget,
            evaluateSubscriptionBudget(previous, payload.effective_at).released_vc_total,
          )
        : Math.min(payload.vc_budget, payload.daily_burn_amount);
      snapshot.subscriptions[payload.subscription_id] = {
        subscription_id: payload.subscription_id,
        investor_id: payload.investor_id,
        signal_key: payload.signal_key,
        product_id: payload.product_id,
        status: payload.status,
        vc_budget: payload.vc_budget,
        released_vc_total: round(Math.max(0, carried_release)),
        available_vc: round(Math.max(0, carried_release)),
        funding_account: round(Math.max(0, carried_release)),
        trading_account: previous?.trading_account ?? 0,
        precision_locked_amount: previous?.precision_locked_amount ?? 0,
        precision_lock_source_event_id: previous?.precision_lock_source_event_id,
        daily_burn_amount: payload.daily_burn_amount,
        last_budget_eval_at: payload.effective_at,
        profit_target_value: payload.profit_target_value,
        signing_public_key: payload.signing_public_key,
        reserve_account_ref: payload.reserve_account_ref,
        target_position_qty: previous?.target_position_qty ?? 0,
        settled_position_qty: previous?.settled_position_qty ?? 0,
        last_signal_id: previous?.last_signal_id,
        last_intent_id: previous?.last_intent_id,
        last_effective_stop_loss_price: previous?.last_effective_stop_loss_price,
        last_entry_price: previous?.last_entry_price,
        contract_multiplier: payload.contract_multiplier,
        lot_size: payload.lot_size,
      };
      ensureInvestorBuffer(snapshot.investor_buffers, payload.investor_id);
      recalculateSubscription(snapshot.subscriptions[payload.subscription_id]);
      markPrecisionLockSource(snapshot.subscriptions[payload.subscription_id], event.event_id);
      appendAuditEvent(
        snapshot.audit_by_subscription_id,
        payload.subscription_id,
        event.event_id,
        event.event_type,
      );
      break;
    }
    case 'SignalReceived': {
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.event_type,
      );
      break;
    }
    case 'SignalForcedFlatHandled': {
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.event_type,
      );
      for (const subscription_id of event.payload.subscription_ids) {
        appendAuditEvent(
          snapshot.audit_by_subscription_id,
          subscription_id,
          event.event_id,
          event.event_type,
        );
      }
      break;
    }
    case 'IntentCreated': {
      const payload = event.payload;
      const subscription = snapshot.subscriptions[payload.subscription_id];
      if (subscription) {
        subscription.target_position_qty = payload.target_position_qty;
        subscription.last_signal_id = payload.signal_id;
        subscription.last_intent_id = payload.intent_id;
        if (payload.entry_price !== undefined) {
          subscription.last_entry_price = payload.entry_price;
        }
        if (payload.stop_loss_price !== undefined) {
          subscription.last_effective_stop_loss_price = payload.stop_loss_price;
        }
        recalculateSubscription(subscription);
        markPrecisionLockSource(subscription, event.event_id);
      }
      appendAuditEvent(snapshot.audit_by_signal_id, payload.signal_id, event.event_id, event.event_type);
      appendAuditEvent(
        snapshot.audit_by_subscription_id,
        payload.subscription_id,
        event.event_id,
        event.event_type,
      );
      break;
    }
    case 'IntentRejected': {
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.event_type,
      );
      appendAuditEvent(
        snapshot.audit_by_subscription_id,
        event.payload.subscription_id,
        event.event_id,
        `${event.event_type}:${event.payload.reason}`,
      );
      break;
    }
    case 'AlertTriggered': {
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.payload.type,
      );
      appendAuditEvent(
        snapshot.audit_by_subscription_id,
        event.payload.subscription_id,
        event.event_id,
        event.payload.type,
      );
      appendAuditEvent(
        snapshot.audit_by_order_id,
        event.payload.order_id,
        event.event_id,
        event.payload.type,
      );
      break;
    }
    case 'OrderSubmitted': {
      snapshot.orders[event.payload.order_id] = {
        order_id: event.payload.order_id,
        signal_id: event.payload.signal_id,
        product_id: event.payload.product_id,
        status: 'submitted',
        target_net_qty: event.payload.target_net_qty,
        current_net_qty: event.payload.current_net_qty,
        external_order_delta: event.payload.external_order_delta,
        attribution: event.payload.attribution,
        stop_loss_price: event.payload.stop_loss_price,
        filled_qty: 0,
        fee_total: 0,
      };
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.event_type,
      );
      appendAuditEvent(snapshot.audit_by_order_id, event.payload.order_id, event.event_id, event.event_type);
      for (const item of event.payload.attribution) {
        appendAuditEvent(
          snapshot.audit_by_subscription_id,
          item.subscription_id,
          event.event_id,
          event.event_type,
        );
      }
      break;
    }
    case 'OrderAccepted': {
      const order = snapshot.orders[event.payload.order_id];
      if (order) {
        order.status = 'accepted';
      }
      appendAuditEvent(snapshot.audit_by_order_id, event.payload.order_id, event.event_id, event.event_type);
      break;
    }
    case 'OrderRejected': {
      const order = snapshot.orders[event.payload.order_id];
      if (order) {
        order.status = 'rejected';
      }
      appendAuditEvent(snapshot.audit_by_order_id, event.payload.order_id, event.event_id, event.event_type);
      break;
    }
    case 'IntentReleased': {
      for (const subscription_id of event.payload.subscription_ids) {
        const subscription = snapshot.subscriptions[subscription_id];
        if (!subscription) continue;
        subscription.target_position_qty = subscription.settled_position_qty;
        recalculateSubscription(subscription);
        markPrecisionLockSource(subscription, event.event_id);
        appendAuditEvent(
          snapshot.audit_by_subscription_id,
          subscription_id,
          event.event_id,
          event.event_type,
        );
      }
      appendAuditEvent(snapshot.audit_by_order_id, event.payload.order_id, event.event_id, event.event_type);
      break;
    }
    case 'OrderFilled': {
      const order = snapshot.orders[event.payload.order_id];
      if (order) {
        order.filled_qty = round(event.payload.cumulative_filled_qty);
        order.avg_fill_price = event.payload.avg_fill_price;
        order.fee_total = round(order.fee_total + event.payload.fee);
        order.status = event.payload.status;
      }
      for (const { subscription_id, qty } of allocateFill(
        event.payload.fill_qty,
        event.payload.attribution,
      )) {
        const subscription = snapshot.subscriptions[subscription_id];
        if (!subscription) continue;
        subscription.settled_position_qty = round(subscription.settled_position_qty + qty);
        recalculateSubscription(subscription);
        markPrecisionLockSource(subscription, event.event_id);
        appendAuditEvent(
          snapshot.audit_by_subscription_id,
          subscription_id,
          event.event_id,
          event.event_type,
        );
      }
      appendAuditEvent(snapshot.audit_by_order_id, event.payload.order_id, event.event_id, event.event_type);
      break;
    }
    case 'ExecutionTimeoutObserved': {
      appendAuditEvent(snapshot.audit_by_order_id, event.payload.order_id, event.event_id, event.event_type);
      break;
    }
    case 'MidPriceCaptured':
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.event_type,
      );
      break;
    case 'InternalNettingSettled': {
      for (const item of event.payload.attribution) {
        const subscription = snapshot.subscriptions[item.subscription_id];
        if (!subscription) continue;
        subscription.settled_position_qty = round(item.target_qty);
        recalculateSubscription(subscription);
        markPrecisionLockSource(subscription, event.event_id);
        appendAuditEvent(
          snapshot.audit_by_subscription_id,
          item.subscription_id,
          event.event_id,
          event.event_type,
        );
      }
      appendAuditEvent(
        snapshot.audit_by_signal_id,
        event.payload.signal_id,
        event.event_id,
        event.event_type,
      );
      break;
    }
    case 'AuthorizedAccountSnapshotCaptured': {
      const current = snapshot.reconciliation[event.payload.account_id] ?? {
        account_id: event.payload.account_id,
        projected_balance: 0,
        rounded_projected_balance: 0,
        status: 'idle',
      };
      snapshot.reconciliation[event.payload.account_id] = {
        ...current,
        latest_snapshot_id: event.payload.snapshot_id,
        observed_balance: event.payload.balance,
      } satisfies ReconciliationProjection;
      break;
    }
    case 'ReconciliationMatched': {
      snapshot.reconciliation[event.payload.account_id] = {
        latest_snapshot_id: event.payload.snapshot_id,
        account_id: event.payload.account_id,
        projected_balance: event.payload.projected_balance,
        rounded_projected_balance: event.payload.rounded_projected_balance,
        observed_balance: event.payload.observed_balance,
        difference: event.payload.difference,
        tolerance: event.payload.tolerance,
        explanation: event.payload.explanation,
        status: 'matched',
      };
      break;
    }
    case 'ReconciliationMismatchDetected': {
      snapshot.reconciliation[event.payload.account_id] = {
        latest_snapshot_id: event.payload.snapshot_id,
        account_id: event.payload.account_id,
        projected_balance: event.payload.projected_balance,
        rounded_projected_balance: event.payload.rounded_projected_balance,
        observed_balance: event.payload.observed_balance,
        difference: event.payload.difference,
        tolerance: event.payload.tolerance,
        explanation: event.payload.explanation,
        status: 'mismatch',
      };
      snapshot.mode = 'audit_only';
      break;
    }
    case 'AuditModeRestored': {
      snapshot.mode = 'normal';
      break;
    }
  }

  recalculateProducts(snapshot);
  recalculateReconciliation(snapshot);
  recalculateInvestorBuffers(snapshot);
};

export const reduceEvents = (events: DomainEvent[]) => {
  const snapshot = createEmptySnapshot();
  for (const event of events) {
    applyEventToSnapshot(snapshot, event);
  }
  return snapshot;
};
