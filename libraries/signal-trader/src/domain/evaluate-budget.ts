import {
  EventSourcedTradingState,
  InvestorBufferAccount,
  LiveTradingSnapshot,
  SubscriptionState,
} from '../types/snapshot';

export const DAY_MS = 86_400_000;

const round = (value: number) => Math.round(value * 1_000_000_000) / 1_000_000_000;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const assertFiniteNumber = (value: number, name: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name.toUpperCase()}_INVALID`);
  }
};

const getRiskPerUnit = (subscription: SubscriptionState) => {
  if (
    subscription.last_entry_price === undefined ||
    subscription.last_effective_stop_loss_price === undefined
  ) {
    return 0;
  }
  return (
    Math.abs(subscription.last_entry_price - subscription.last_effective_stop_loss_price) *
    subscription.contract_multiplier
  );
};

export const getCurrentReservedVc = (subscription: SubscriptionState) => {
  const risk_per_unit = getRiskPerUnit(subscription);
  if (!Number.isFinite(risk_per_unit) || risk_per_unit <= 0) {
    return 0;
  }
  return round(Math.abs(subscription.target_position_qty) * risk_per_unit);
};

export const getPrecisionLockedAmount = (
  subscription: SubscriptionState,
  released_vc_total: number,
  current_reserved_vc: number,
) => {
  if (subscription.target_position_qty === 0) {
    return 0;
  }
  const risk_per_unit = getRiskPerUnit(subscription);
  const lot_size = subscription.lot_size ?? 1;
  const precision_step = round(risk_per_unit * lot_size);
  if (!Number.isFinite(precision_step) || precision_step <= 0) {
    return 0;
  }
  const max_tradable_vc = Math.floor(released_vc_total / precision_step) * precision_step;
  const precision_locked_amount = round(released_vc_total - max_tradable_vc);
  if (precision_locked_amount <= 0) {
    return 0;
  }
  return round(Math.min(precision_locked_amount, Math.max(0, released_vc_total - current_reserved_vc)));
};

const inferReleasedVcTotal = (subscription: SubscriptionState, current_reserved_vc: number) => {
  const legacy_release = round(
    Math.max(0, subscription.available_vc) +
      Math.max(0, subscription.precision_locked_amount) +
      Math.min(current_reserved_vc, subscription.vc_budget),
  );
  return clamp(subscription.released_vc_total ?? legacy_release, 0, subscription.vc_budget);
};

export interface EvaluatedSubscriptionBudget {
  released_vc_total: number;
  current_reserved_vc: number;
  available_vc: number;
  funding_account: number;
  trading_account: number;
  precision_locked_amount: number;
  sizing_vc_budget: number;
  last_budget_eval_at: number;
}

export const evaluateSubscriptionBudget = (
  subscription: SubscriptionState,
  now_ms: number,
): EvaluatedSubscriptionBudget => {
  assertFiniteNumber(now_ms, 'now_ms');

  const current_reserved_vc = getCurrentReservedVc(subscription);
  const last_budget_eval_at = Number.isFinite(subscription.last_budget_eval_at)
    ? subscription.last_budget_eval_at
    : now_ms;
  const daily_burn_amount = Number.isFinite(subscription.daily_burn_amount)
    ? Math.max(0, subscription.daily_burn_amount)
    : 0;

  let released_vc_total = inferReleasedVcTotal(subscription, current_reserved_vc);
  let evaluated_at = last_budget_eval_at;

  if (now_ms > evaluated_at && daily_burn_amount > 0) {
    const elapsed_days = Math.floor((now_ms - evaluated_at) / DAY_MS);
    if (elapsed_days > 0) {
      released_vc_total = clamp(
        round(released_vc_total + elapsed_days * daily_burn_amount),
        0,
        subscription.vc_budget,
      );
      evaluated_at += elapsed_days * DAY_MS;
    }
  }

  const precision_locked_amount = getPrecisionLockedAmount(
    subscription,
    released_vc_total,
    current_reserved_vc,
  );
  const funding_account = round(Math.max(0, subscription.vc_budget - released_vc_total));
  const trading_account = released_vc_total;
  const available_vc = round(Math.max(0, trading_account - current_reserved_vc - precision_locked_amount));
  const sizing_vc_budget = round(
    Math.max(Math.max(0, trading_account - precision_locked_amount), current_reserved_vc),
  );

  return {
    released_vc_total,
    current_reserved_vc,
    available_vc,
    funding_account,
    trading_account,
    precision_locked_amount,
    sizing_vc_budget,
    last_budget_eval_at: evaluated_at,
  };
};

export const refreshSubscriptionBudget = (
  subscription: SubscriptionState,
  now_ms: number,
): SubscriptionState => {
  const evaluated = evaluateSubscriptionBudget(subscription, now_ms);
  return {
    ...subscription,
    released_vc_total: evaluated.released_vc_total,
    available_vc: evaluated.available_vc,
    funding_account: evaluated.funding_account,
    trading_account: evaluated.trading_account,
    precision_locked_amount: evaluated.precision_locked_amount,
    precision_lock_source_event_id: evaluated.precision_locked_amount
      ? subscription.precision_lock_source_event_id
      : undefined,
    last_budget_eval_at: evaluated.last_budget_eval_at,
  };
};

const rebuildInvestorBuffers = (subscriptions: Record<string, SubscriptionState>) => {
  const nextInvestorBuffers: Record<string, InvestorBufferAccount> = {};

  for (const subscription of Object.values(subscriptions)) {
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

  return nextInvestorBuffers;
};

export const getProjectedBalanceForAccount = (snapshot: LiveTradingSnapshot, account_id: string) => {
  const subscriptions = Object.values(snapshot.subscriptions);
  const hasScopedSubscriptions = subscriptions.some((subscription) => !!subscription.reserve_account_ref);
  const scoped = hasScopedSubscriptions
    ? subscriptions.filter((subscription) => subscription.reserve_account_ref === account_id)
    : subscriptions;
  return round(scoped.reduce((sum, subscription) => sum + subscription.trading_account, 0));
};

export const refreshSnapshotBudget = (snapshot: LiveTradingSnapshot, now_ms: number): LiveTradingSnapshot => {
  assertFiniteNumber(now_ms, 'now_ms');

  const subscriptions = Object.fromEntries(
    Object.entries(snapshot.subscriptions).map(([subscription_id, subscription]) => [
      subscription_id,
      refreshSubscriptionBudget(subscription, now_ms),
    ]),
  );
  const nextSnapshot = {
    ...snapshot,
    subscriptions,
  } satisfies LiveTradingSnapshot;
  const reconciliation = Object.fromEntries(
    Object.entries(snapshot.reconciliation).map(([account_id, item]) => [
      account_id,
      {
        ...item,
        projected_balance: getProjectedBalanceForAccount(nextSnapshot, account_id),
        rounded_projected_balance: getProjectedBalanceForAccount(nextSnapshot, account_id),
        difference:
          item.observed_balance === undefined
            ? undefined
            : round(item.observed_balance - getProjectedBalanceForAccount(nextSnapshot, account_id)),
      },
    ]),
  );

  return {
    ...nextSnapshot,
    investor_buffers: rebuildInvestorBuffers(subscriptions),
    reconciliation,
  };
};

export const refreshTradingStateBudget = (state: EventSourcedTradingState): EventSourcedTradingState => {
  return {
    ...state,
    snapshot: refreshSnapshotBudget(state.snapshot, state.clock_ms),
  };
};
