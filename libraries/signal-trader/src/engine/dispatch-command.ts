import { encodePath } from '@yuants/utils';
import { computeTargetPosition } from '../domain/compute-target-position';
import {
  evaluateSubscriptionBudget,
  getProjectedBalanceForAccount,
  refreshTradingStateBudget,
} from '../domain/evaluate-budget';
import { appendEvents } from './append-events';
import { DomainCommand, getCommandIdempotencyKey } from '../types/commands';
import { AttributionEntry, DomainEvent } from '../types/events';
import {
  DispatchResult,
  EventSourcedTradingState,
  PlannedEffect,
  SubscriptionState,
} from '../types/snapshot';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
};

const normalizeCommandForFingerprint = (command: DomainCommand): DomainCommand | Record<string, unknown> => {
  if (command.command_type !== 'submit_signal') return command;
  const {
    reference_price: _reference_price,
    reference_price_source: _reference_price_source,
    reference_price_datasource_id: _reference_price_datasource_id,
    reference_price_updated_at: _reference_price_updated_at,
    ...rest
  } = command;
  return rest;
};

const sign = (value: number) => {
  if (value === 0) return 0;
  return value > 0 ? 1 : -1;
};

const round = (value: number) => Math.round(value * 1_000_000_000) / 1_000_000_000;
const RECONCILIATION_TOLERANCE = 0.000001;

const sanitizeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;
  const allow_list = new Set(['trace_id', 'reference_id', 'tags']);
  const sanitized = Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (!allow_list.has(key)) return false;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
      if (Array.isArray(value)) return value.every((item) => typeof item === 'string');
      return false;
    }),
  );
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const makeEvent = <T extends DomainEvent['event_type']>(
  state: EventSourcedTradingState,
  idempotency_key: string,
  command_fingerprint: string,
  event_type: T,
  payload: Extract<DomainEvent, { event_type: T }>['payload'],
  index: number,
): Extract<DomainEvent, { event_type: T }> => {
  return {
    event_id: encodePath(event_type, idempotency_key, state.events.length + index + 1),
    event_type,
    schema_version: 1,
    reducer_version: 1,
    idempotency_key,
    command_fingerprint,
    created_at: state.clock_ms,
    payload,
  } as Extract<DomainEvent, { event_type: T }>;
};

const buildAlertConflictEvent = (
  state: EventSourcedTradingState,
  idempotency_key: string,
  command_fingerprint: string,
) => {
  return makeEvent(
    state,
    idempotency_key,
    command_fingerprint,
    'AlertTriggered',
    {
      type: 'idempotency_conflict',
      message: 'same idempotency key with different payload',
    },
    0,
  );
};

const buildPlannedEffects = (state: EventSourcedTradingState, events: DomainEvent[]): PlannedEffect[] => {
  const effects: PlannedEffect[] = [];
  const seen_order_ids = new Set<string>();

  for (const event of events) {
    if (event.event_type !== 'OrderSubmitted') continue;
    effects.push({
      effect_type: 'place_order',
      order_id: event.payload.order_id,
      signal_id: event.payload.signal_id,
      product_id: event.payload.product_id,
      size: event.payload.external_order_delta,
      stop_loss_price: event.payload.stop_loss_price,
      attribution: event.payload.attribution,
    });
    seen_order_ids.add(event.payload.order_id);
  }

  const released_subscription_ids = new Set(
    events.flatMap((event) => (event.event_type === 'IntentReleased' ? event.payload.subscription_ids : [])),
  );

  if (released_subscription_ids.size === 0) {
    return effects;
  }

  const impacted_product_ids = new Set(
    Object.values(state.snapshot.orders)
      .filter(
        (order) =>
          ['submitted', 'accepted', 'partially_filled'].includes(order.status) &&
          order.attribution.some((item) => released_subscription_ids.has(item.subscription_id)),
      )
      .map((order) => order.product_id),
  );

  for (const product_id of impacted_product_ids) {
    const active_orders = Object.values(state.snapshot.orders)
      .filter(
        (order) =>
          order.product_id === product_id &&
          ['submitted', 'accepted', 'partially_filled'].includes(order.status) &&
          !seen_order_ids.has(order.order_id),
      )
      .sort((left, right) => left.order_id.localeCompare(right.order_id));

    const product = state.snapshot.products[product_id];
    const desired_delta = round((product?.target_net_qty ?? 0) - (product?.current_net_qty ?? 0));

    if (desired_delta === 0) {
      for (const order of active_orders) {
        effects.push({
          effect_type: 'cancel_order',
          order_id: order.order_id,
          product_id: order.product_id,
        });
      }
      continue;
    }

    const [keeper, ...rest] = active_orders;
    if (!keeper) {
      continue;
    }

    const keeper_remaining = round(
      keeper.external_order_delta - sign(keeper.external_order_delta || 0) * keeper.filled_qty,
    );
    if (keeper_remaining !== desired_delta) {
      effects.push({
        effect_type: 'modify_order',
        order_id: keeper.order_id,
        product_id: keeper.product_id,
        next_size: desired_delta,
      });
    }

    for (const order of rest) {
      effects.push({
        effect_type: 'cancel_order',
        order_id: order.order_id,
        product_id: order.product_id,
      });
    }
  }

  return effects;
};

const collectOrderAttribution = (
  subscriptions: Record<string, SubscriptionState>,
  product_id: string,
): AttributionEntry[] => {
  return Object.values(subscriptions)
    .map((subscription) => ({
      subscription,
      target_qty: round(subscription.target_position_qty - subscription.settled_position_qty),
    }))
    .filter(
      ({ subscription, target_qty }) =>
        subscription.status === 'active' && subscription.product_id === product_id && target_qty !== 0,
    )
    .sort((left, right) =>
      left.subscription.subscription_id.localeCompare(right.subscription.subscription_id),
    )
    .map(({ subscription, target_qty }, index) => ({
      subscription_id: subscription.subscription_id,
      target_qty,
      allocation_rank: index,
    }));
};

const collectInternalNettingAttribution = (
  subscriptions: Record<string, SubscriptionState>,
  product_id: string,
): AttributionEntry[] => {
  return Object.values(subscriptions)
    .filter(
      (subscription) =>
        subscription.product_id === product_id &&
        (subscription.target_position_qty !== 0 || subscription.settled_position_qty !== 0),
    )
    .sort((left, right) => left.subscription_id.localeCompare(right.subscription_id))
    .map((subscription, index) => ({
      subscription_id: subscription.subscription_id,
      target_qty: subscription.target_position_qty,
      allocation_rank: index,
    }));
};

const collectTargetChanges = (
  previous: Record<string, SubscriptionState>,
  next: Record<string, SubscriptionState>,
  product_id: string,
) => {
  return Object.values(next)
    .filter((subscription) => subscription.product_id === product_id)
    .map((subscription) => ({
      subscription_id: subscription.subscription_id,
      delta: round(
        subscription.target_position_qty - (previous[subscription.subscription_id]?.target_position_qty ?? 0),
      ),
    }))
    .filter((item) => item.delta !== 0);
};

const hasFormalReferencePriceEvidence = (
  command: Extract<DomainCommand, { command_type: 'submit_signal' }>,
) => {
  return (
    Number.isFinite(command.reference_price) &&
    Number(command.reference_price) > 0 &&
    typeof command.reference_price_source === 'string' &&
    command.reference_price_source.startsWith('sql.quote.') &&
    typeof command.reference_price_datasource_id === 'string' &&
    command.reference_price_datasource_id.length > 0 &&
    typeof command.reference_price_updated_at === 'string' &&
    command.reference_price_updated_at.length > 0
  );
};

const hasBlockingOpenOrders = (state: EventSourcedTradingState, product_id: string) => {
  return Object.values(state.snapshot.orders).some(
    (order) =>
      order.product_id === product_id && ['submitted', 'accepted', 'partially_filled'].includes(order.status),
  );
};

const buildProfitTargetAlertMessage = (
  account_id: string,
  snapshot_id: string,
  observed_value: number,
  candidate_subscriptions: SubscriptionState[],
) => {
  const subscription_ids = candidate_subscriptions.map((item) => item.subscription_id).sort();
  const targets = candidate_subscriptions
    .map((item) => `${item.subscription_id}:${item.profit_target_value}`)
    .join('|');
  return [
    'advisory_scope=account',
    'action=auto_flat_profile_close',
    `account_id=${account_id}`,
    `snapshot_id=${snapshot_id}`,
    `candidate_subscriptions=${subscription_ids.join(',')}`,
    `observed=${observed_value}`,
    `targets=${targets}`,
  ].join('; ');
};

const buildIntentRejected = (
  state: EventSourcedTradingState,
  idempotency_key: string,
  command_fingerprint: string,
  signal_id: string,
  product_id: string,
  subscription_id: string | undefined,
  reason: Extract<Extract<DomainEvent, { event_type: 'IntentRejected' }>['payload']['reason'], string>,
  detail?: string,
  index = 0,
) => {
  return makeEvent(
    state,
    idempotency_key,
    command_fingerprint,
    'IntentRejected',
    {
      intent_id: encodePath('intent', signal_id, subscription_id ?? 'none', reason),
      subscription_id,
      signal_id,
      product_id,
      reason,
      detail,
    },
    index,
  );
};

const buildRiskRejectedAlert = (
  state: EventSourcedTradingState,
  idempotency_key: string,
  command_fingerprint: string,
  signal_id: string,
  subscription_id: string | undefined,
  message: string,
  index: number,
) => {
  return makeEvent(
    state,
    idempotency_key,
    command_fingerprint,
    'AlertTriggered',
    {
      type: 'risk_rejected',
      signal_id,
      subscription_id,
      message,
    },
    index,
  );
};

const handleUpsertSubscription = (
  state: EventSourcedTradingState,
  command: Extract<DomainCommand, { command_type: 'upsert_subscription' }>,
  idempotency_key: string,
  command_fingerprint: string,
) => {
  const events: DomainEvent[] = [
    makeEvent(
      state,
      idempotency_key,
      command_fingerprint,
      'SubscriptionUpdated',
      {
        ...command,
        contract_multiplier: command.contract_multiplier ?? 1,
        lot_size: command.lot_size ?? 1,
      },
      0,
    ),
  ];

  const previous = state.snapshot.subscriptions[command.subscription_id];
  if (
    previous &&
    command.status !== 'active' &&
    previous.target_position_qty !== previous.settled_position_qty
  ) {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'IntentReleased',
        {
          order_id: encodePath('subscription-status-change', command.subscription_id, command.effective_at),
          subscription_ids: [command.subscription_id],
          reason: 'cancelled',
        },
        events.length,
      ),
    );
  }

  return events;
};

const handleSubmitSignal = (
  state: EventSourcedTradingState,
  command: Extract<DomainCommand, { command_type: 'submit_signal' }>,
  idempotency_key: string,
  command_fingerprint: string,
) => {
  const events: DomainEvent[] = [
    makeEvent(
      state,
      idempotency_key,
      command_fingerprint,
      'SignalReceived',
      { ...command, metadata: sanitizeMetadata(command.metadata) },
      0,
    ),
  ];

  const allow_agent_forced_flat_in_audit =
    state.snapshot.mode !== 'normal' && command.signal === 0 && command.source === 'agent';
  if (state.snapshot.mode !== 'normal' && !allow_agent_forced_flat_in_audit) {
    events.push(
      buildIntentRejected(
        state,
        idempotency_key,
        command_fingerprint,
        command.signal_id,
        command.product_id,
        undefined,
        'unknown',
        'AUDIT_ONLY_MODE',
        events.length,
      ),
    );
    events.push(
      buildRiskRejectedAlert(
        state,
        idempotency_key,
        command_fingerprint,
        command.signal_id,
        undefined,
        'audit_only mode blocks new execution intents',
        events.length,
      ),
    );
    return events;
  }

  const matched_subscriptions = Object.values(state.snapshot.subscriptions).filter(
    (subscription) =>
      subscription.signal_key === command.signal_key && subscription.product_id === command.product_id,
  );

  if (command.signal === 0) {
    for (const [index, subscription] of matched_subscriptions.entries()) {
      if (subscription.status !== 'active') continue;
      events.push(
        makeEvent(
          state,
          idempotency_key,
          command_fingerprint,
          'IntentCreated',
          {
            intent_id: encodePath('intent', command.signal_id, subscription.subscription_id, 'forced-flat'),
            subscription_id: subscription.subscription_id,
            signal_id: command.signal_id,
            product_id: command.product_id,
            signal: command.signal,
            target_position_qty: 0,
            reason: 'forced_flat',
          },
          events.length + index,
        ),
      );
    }
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'SignalForcedFlatHandled',
        {
          signal_id: command.signal_id,
          signal_key: command.signal_key,
          product_id: command.product_id,
          subscription_ids: matched_subscriptions.map((item) => item.subscription_id),
        },
        events.length,
      ),
    );
  } else {
    for (const subscription of matched_subscriptions) {
      if (subscription.status !== 'active') {
        events.push(
          buildIntentRejected(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            command.product_id,
            subscription.subscription_id,
            'subscription_inactive',
            undefined,
            events.length,
          ),
        );
        continue;
      }

      const current_direction = sign(subscription.settled_position_qty || subscription.target_position_qty);
      if (
        current_direction === command.signal &&
        subscription.settled_position_qty !== 0 &&
        command.stop_loss_price !== undefined &&
        subscription.last_effective_stop_loss_price !== undefined &&
        command.stop_loss_price !== subscription.last_effective_stop_loss_price
      ) {
        events.push(
          buildIntentRejected(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            command.product_id,
            subscription.subscription_id,
            'stop_loss_mutation_forbidden',
            undefined,
            events.length,
          ),
        );
        events.push(
          buildRiskRejectedAlert(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            subscription.subscription_id,
            'stop loss mutation is forbidden for existing exposure',
            events.length,
          ),
        );
        continue;
      }

      const requires_new_risk =
        current_direction !== command.signal || subscription.settled_position_qty === 0;
      if ((command.entry_price === undefined || command.stop_loss_price === undefined) && requires_new_risk) {
        events.push(
          buildIntentRejected(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            command.product_id,
            subscription.subscription_id,
            'missing_or_invalid_entry_or_stop_loss',
            undefined,
            events.length,
          ),
        );
        events.push(
          buildRiskRejectedAlert(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            subscription.subscription_id,
            'entry_price and stop_loss_price are required when risk exposure increases',
            events.length,
          ),
        );
        continue;
      }

      if (command.entry_price === undefined || command.stop_loss_price === undefined) {
        continue;
      }

      try {
        const budget = evaluateSubscriptionBudget(subscription, state.clock_ms);
        const target_position_qty = computeTargetPosition({
          signal: command.signal,
          vc_budget: budget.sizing_vc_budget,
          entry_price: command.entry_price,
          stop_loss_price: command.stop_loss_price,
          contract_multiplier: subscription.contract_multiplier,
          lot_size: subscription.lot_size,
        });

        if (
          current_direction === command.signal &&
          budget.current_reserved_vc > Math.max(0, budget.trading_account - budget.precision_locked_amount) &&
          Math.abs(target_position_qty) > Math.abs(subscription.target_position_qty)
        ) {
          events.push(
            buildIntentRejected(
              state,
              idempotency_key,
              command_fingerprint,
              command.signal_id,
              command.product_id,
              subscription.subscription_id,
              'vc_insufficient',
              'OVER_RESERVED_NO_EXPANSION',
              events.length,
            ),
          );
          events.push(
            buildRiskRejectedAlert(
              state,
              idempotency_key,
              command_fingerprint,
              command.signal_id,
              subscription.subscription_id,
              'current exposure already exceeds released budget; expansion is blocked until release catches up',
              events.length,
            ),
          );
          continue;
        }

        events.push(
          makeEvent(
            state,
            idempotency_key,
            command_fingerprint,
            'IntentCreated',
            {
              intent_id: encodePath('intent', command.signal_id, subscription.subscription_id),
              subscription_id: subscription.subscription_id,
              signal_id: command.signal_id,
              product_id: command.product_id,
              signal: command.signal,
              target_position_qty,
              entry_price: command.entry_price,
              stop_loss_price: command.stop_loss_price,
              reason: 'open_or_rebalance',
            },
            events.length,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';
        events.push(
          buildIntentRejected(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            command.product_id,
            subscription.subscription_id,
            message === 'VC_INSUFFICIENT' ? 'vc_insufficient' : 'missing_or_invalid_entry_or_stop_loss',
            message,
            events.length,
          ),
        );
        events.push(
          buildRiskRejectedAlert(
            state,
            idempotency_key,
            command_fingerprint,
            command.signal_id,
            subscription.subscription_id,
            message,
            events.length,
          ),
        );
      }
    }
  }

  const preview_state = appendEvents(state, events);
  const product = preview_state.snapshot.products[command.product_id];
  const target_net_qty = product?.target_net_qty ?? 0;
  const current_net_qty = product?.current_net_qty ?? 0;
  const external_order_delta = round(target_net_qty - current_net_qty);

  if (external_order_delta !== 0) {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'OrderSubmitted',
        {
          order_id: encodePath('order', command.signal_id, command.product_id),
          signal_id: command.signal_id,
          product_id: command.product_id,
          target_net_qty,
          current_net_qty,
          external_order_delta,
          attribution: collectOrderAttribution(preview_state.snapshot.subscriptions, command.product_id),
          stop_loss_price: command.stop_loss_price,
        },
        events.length,
      ),
    );
    return events;
  }

  const target_changes = collectTargetChanges(
    state.snapshot.subscriptions,
    preview_state.snapshot.subscriptions,
    command.product_id,
  );
  const has_internal_reallocation =
    target_changes.length >= 2 &&
    target_changes.some((item) => item.delta > 0) &&
    target_changes.some((item) => item.delta < 0) &&
    Object.values(preview_state.snapshot.subscriptions).some(
      (subscription) =>
        subscription.product_id === command.product_id &&
        subscription.target_position_qty !== subscription.settled_position_qty,
    );
  const can_settle_internal_netting =
    has_internal_reallocation &&
    product?.pending_order_qty === 0 &&
    !hasBlockingOpenOrders(preview_state, command.product_id) &&
    hasFormalReferencePriceEvidence(command);

  if (can_settle_internal_netting) {
    const attribution = collectInternalNettingAttribution(
      preview_state.snapshot.subscriptions,
      command.product_id,
    );
    const mid_price = command.reference_price;
    const settled_qty = round(
      attribution.reduce((sum, item) => {
        const current_subscription = preview_state.snapshot.subscriptions[item.subscription_id];
        return sum + Math.abs(item.target_qty - (current_subscription?.settled_position_qty ?? 0));
      }, 0) / 2,
    );

    if (settled_qty > 0 && mid_price !== undefined) {
      const mid_price_event = makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'MidPriceCaptured',
        {
          signal_id: command.signal_id,
          product_id: command.product_id,
          price: mid_price,
          source: command.reference_price_source!,
          datasource_id: command.reference_price_datasource_id,
          quote_updated_at: command.reference_price_updated_at,
        },
        events.length,
      );
      events.push(mid_price_event);
      events.push(
        makeEvent(
          state,
          idempotency_key,
          command_fingerprint,
          'InternalNettingSettled',
          {
            signal_id: command.signal_id,
            product_id: command.product_id,
            mid_price_event_id: mid_price_event.event_id,
            attribution,
            settled_qty,
          },
          events.length,
        ),
      );
    }
  }

  return events;
};

const handleApplyExecutionReport = (
  state: EventSourcedTradingState,
  command: Extract<DomainCommand, { command_type: 'apply_execution_report' }>,
  idempotency_key: string,
  command_fingerprint: string,
) => {
  const order = state.snapshot.orders[command.order_id];
  if (!order) {
    return [
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'AlertTriggered',
        {
          type: 'unknown_execution_report',
          order_id: command.order_id,
          message: 'order not found',
        },
        0,
      ),
    ];
  }

  if (order.product_id !== command.product_id) {
    return [
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'AlertTriggered',
        {
          type: 'unknown_execution_report',
          order_id: command.order_id,
          message: `product_mismatch:${order.product_id}:${command.product_id}`,
        },
        0,
      ),
    ];
  }

  const events: DomainEvent[] = [];
  if (
    ['accepted', 'partially_filled', 'filled', 'stop_triggered'].includes(command.status) &&
    order.status === 'submitted'
  ) {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'OrderAccepted',
        {
          order_id: command.order_id,
          product_id: command.product_id,
          report_id: command.report_id,
        },
        events.length,
      ),
    );
  }

  if (command.status === 'rejected' || command.status === 'cancelled') {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'OrderRejected',
        {
          order_id: command.order_id,
          product_id: command.product_id,
          report_id: command.report_id,
          reason: command.status,
        },
        events.length,
      ),
    );
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'IntentReleased',
        {
          order_id: command.order_id,
          subscription_ids: order.attribution.map((item) => item.subscription_id),
          reason: command.status === 'rejected' ? 'order_rejected' : 'cancelled',
        },
        events.length,
      ),
    );
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'AlertTriggered',
        {
          type: 'order_rejected',
          order_id: command.order_id,
          message: command.status,
        },
        events.length,
      ),
    );
    return events;
  }

  if (command.status === 'accepted') {
    return events;
  }

  const sign_of_order = sign(order.external_order_delta);
  const reported_filled_qty =
    command.filled_qty ??
    (command.status === 'filled' || command.status === 'stop_triggered'
      ? Math.abs(order.external_order_delta)
      : 0);
  const delta_filled_qty = round(Math.max(0, reported_filled_qty - order.filled_qty));

  if (delta_filled_qty > 0) {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'OrderFilled',
        {
          order_id: command.order_id,
          product_id: command.product_id,
          report_id: command.report_id,
          status: command.status === 'partially_filled' ? 'partially_filled' : command.status,
          fill_qty: round(delta_filled_qty * sign_of_order),
          cumulative_filled_qty: reported_filled_qty,
          avg_fill_price: command.avg_fill_price ?? 0,
          fee: command.fee ?? 0,
          attribution: order.attribution,
        },
        events.length,
      ),
    );
  }

  return events;
};

const handleCaptureAuthorizedAccountSnapshot = (
  state: EventSourcedTradingState,
  command: Extract<DomainCommand, { command_type: 'capture_authorized_account_snapshot' }>,
  idempotency_key: string,
  command_fingerprint: string,
) => {
  const observed_balance = round(command.equity ?? command.balance);
  const events: DomainEvent[] = [
    makeEvent(
      state,
      idempotency_key,
      command_fingerprint,
      'AuthorizedAccountSnapshotCaptured',
      { ...command, metadata: sanitizeMetadata(command.metadata) },
      0,
    ),
  ];
  const projected_balance = getProjectedBalanceForAccount(state.snapshot, command.account_id);
  const rounded_projected_balance = round(projected_balance);
  const difference = round(observed_balance - rounded_projected_balance);
  const explanation =
    Math.abs(difference) <= RECONCILIATION_TOLERANCE
      ? 'difference_within_tolerance'
      : 'difference_exceeds_tolerance';

  events.push(
    makeEvent(
      state,
      idempotency_key,
      command_fingerprint,
      Math.abs(difference) <= RECONCILIATION_TOLERANCE
        ? 'ReconciliationMatched'
        : 'ReconciliationMismatchDetected',
      {
        snapshot_id: command.snapshot_id,
        account_id: command.account_id,
        projected_balance,
        rounded_projected_balance,
        observed_balance,
        difference,
        tolerance: RECONCILIATION_TOLERANCE,
        explanation,
      },
      1,
    ),
  );

  if (Math.abs(difference) > RECONCILIATION_TOLERANCE) {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'AlertTriggered',
        {
          type: 'reconciliation_mismatch',
          message: `projected=${rounded_projected_balance}, observed=${observed_balance}, difference=${difference}, tolerance=${RECONCILIATION_TOLERANCE}`,
        },
        2,
      ),
    );
  }

  const hasScopedSubscriptions = Object.values(state.snapshot.subscriptions).some(
    (subscription) => !!subscription.reserve_account_ref,
  );
  const candidate_subscriptions = Object.values(state.snapshot.subscriptions).filter((subscription) => {
    if (subscription.status !== 'active') return false;
    if (subscription.profit_target_value === undefined) return false;
    if (hasScopedSubscriptions && subscription.reserve_account_ref !== command.account_id) return false;
    return observed_balance >= subscription.profit_target_value;
  });

  if (candidate_subscriptions.length > 0) {
    events.push(
      makeEvent(
        state,
        idempotency_key,
        command_fingerprint,
        'AlertTriggered',
        {
          type: 'profit_target_reached',
          message: buildProfitTargetAlertMessage(
            command.account_id,
            command.snapshot_id,
            observed_balance,
            candidate_subscriptions,
          ),
        },
        events.length,
      ),
    );
  }

  return events;
};

const handleRestoreAuditMode = (
  state: EventSourcedTradingState,
  command: Extract<DomainCommand, { command_type: 'restore_audit_mode' }>,
  idempotency_key: string,
  command_fingerprint: string,
) => {
  if (state.snapshot.mode !== 'audit_only') {
    return [] as DomainEvent[];
  }

  return [
    makeEvent(
      state,
      idempotency_key,
      command_fingerprint,
      'AuditModeRestored',
      { ...command, metadata: sanitizeMetadata(command.metadata) },
      0,
    ),
  ];
};

export const dispatchCommand = (state: EventSourcedTradingState, command: DomainCommand): DispatchResult => {
  const prepared_state = refreshTradingStateBudget(state);
  const idempotency_key = getCommandIdempotencyKey(command);
  const command_fingerprint = stableStringify(normalizeCommandForFingerprint(command));
  const existing = prepared_state.snapshot.idempotency[idempotency_key];

  if (existing?.fingerprint === command_fingerprint) {
    return {
      appended_events: [],
      next_snapshot: prepared_state.snapshot,
      next_state: prepared_state,
      planned_effects: [],
    };
  }

  if (existing && existing.fingerprint !== command_fingerprint) {
    const appended_events = [buildAlertConflictEvent(prepared_state, idempotency_key, command_fingerprint)];
    const next_state = refreshTradingStateBudget(appendEvents(prepared_state, appended_events));
    return {
      appended_events,
      next_snapshot: next_state.snapshot,
      next_state,
      planned_effects: [],
    };
  }

  const appended_events = (() => {
    switch (command.command_type) {
      case 'upsert_subscription':
        return handleUpsertSubscription(prepared_state, command, idempotency_key, command_fingerprint);
      case 'submit_signal':
        return handleSubmitSignal(prepared_state, command, idempotency_key, command_fingerprint);
      case 'apply_execution_report':
        return handleApplyExecutionReport(prepared_state, command, idempotency_key, command_fingerprint);
      case 'capture_authorized_account_snapshot':
        return handleCaptureAuthorizedAccountSnapshot(
          prepared_state,
          command,
          idempotency_key,
          command_fingerprint,
        );
      case 'restore_audit_mode':
        return handleRestoreAuditMode(prepared_state, command, idempotency_key, command_fingerprint);
    }
  })();

  const next_state = refreshTradingStateBudget(appendEvents(prepared_state, appended_events));
  return {
    appended_events,
    next_snapshot: next_state.snapshot,
    next_state,
    planned_effects: buildPlannedEffects(next_state, appended_events),
  };
};
