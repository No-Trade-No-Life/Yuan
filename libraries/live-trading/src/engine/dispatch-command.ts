import { newError } from '@yuants/utils';
import { computePositionPlan, validateRiskPolicy } from '../domain/compute-position-plan';
import {
  IAuditEvent,
  IDispatchResult,
  IProcessedSignalSnapshot,
  IInvestorState,
  ILiveTradingEffect,
  ILiveTradingState,
  IRiskPolicy,
  ISignalEnvelope,
  TLiveTradingCommand,
} from '../types';

/**
 * @public
 * Security contract: caller authentication and investor-level authorization
 * must be enforced by the host application before calling this pure core API.
 */
export const dispatchCommand = (state: ILiveTradingState, command: TLiveTradingCommand): IDispatchResult => {
  switch (command.command_type) {
    case 'update_risk_policy': {
      validateRiskPolicy(command.payload.risk_policy);
      const sanitized_risk_policy = deepClone(command.payload.risk_policy);
      const investor = getOrCreateInvestorState(state, command.payload.investor_id, sanitized_risk_policy);
      const next_state: ILiveTradingState = {
        ...state,
        investors: {
          ...state.investors,
          [investor.investor_id]: {
            ...investor,
            policy_version: sanitized_risk_policy.policy_version,
            risk_policy: sanitized_risk_policy,
          },
        },
        audit_events: [...state.audit_events],
        next_event_seq: state.next_event_seq,
        next_effect_seq: state.next_effect_seq,
      };

      const event: IAuditEvent = {
        event_id: `evt_${next_state.next_event_seq}`,
        event_type: 'RiskPolicyUpdated',
        signal_id: `policy_${command.payload.investor_id}_${next_state.next_event_seq}`,
        investor_id: command.payload.investor_id,
        product_id: '__RISK_POLICY__',
        created_at: Date.now(),
        payload: {
          policy_version: sanitized_risk_policy.policy_version,
          policy_fingerprint: stableStringify(sanitized_risk_policy),
        },
      };

      next_state.next_event_seq += 1;
      appendAuditEvent(next_state, event);

      const effect: ILiveTradingEffect = {
        effect_id: `eff_${next_state.next_effect_seq}`,
        effect_type: 'emit_audit_event',
        payload: {
          audit_event: event,
        },
      };
      next_state.next_effect_seq += 1;

      return {
        next_state,
        emitted_events: [event],
        planned_effects: [effect],
      };
    }
    case 'submit_signal':
      return dispatchSubmitSignal(
        state,
        command.payload.signal_envelope,
        command.payload.risk_policy,
        command.payload.entry_price,
      );
    default:
      throw newError('E_UNSUPPORTED_COMMAND', {
        command_type: (command as { command_type: string }).command_type,
      });
  }
};

const dispatchSubmitSignal = (
  state: ILiveTradingState,
  signal_envelope: ISignalEnvelope,
  risk_policy: IRiskPolicy,
  entry_price: number,
): IDispatchResult => {
  try {
    const current_investor = state.investors[signal_envelope.investor_id];
    validateSignalEnvelope(signal_envelope, current_investor?.last_signal_at);
    const fingerprint = stableStringify({ signal_envelope, risk_policy, entry_price });
    const processed_signal_key = buildProcessedSignalKey(signal_envelope);
    const existing = state.processed_signals[processed_signal_key];
    if (existing) {
      if (existing.fingerprint === fingerprint) {
        return {
          next_state: state,
          emitted_events: [],
          planned_effects: [],
        };
      }
      throw newError('E_IDEMPOTENCY_CONFLICT', {
        signal_id: signal_envelope.signal_id,
        processed_signal_key,
        existing_fingerprint: existing.fingerprint,
        incoming_fingerprint: fingerprint,
      });
    }

    const current_product_state = current_investor?.products[signal_envelope.product_id] ?? {
      product_id: signal_envelope.product_id,
      position_direction: 'FLAT' as const,
      open_position_qty: 0,
    };

    const emitted_events: IAuditEvent[] = [];
    const planned_effects: ILiveTradingEffect[] = [];
    const next_state: ILiveTradingState = {
      ...state,
      investors: { ...state.investors },
      audit_events: [...state.audit_events],
      processed_signals: { ...state.processed_signals },
      next_event_seq: state.next_event_seq,
      next_effect_seq: state.next_effect_seq,
    };

    const pushEvent = (event_type: IAuditEvent['event_type'], payload: Record<string, unknown>) => {
      const event: IAuditEvent = {
        event_id: `evt_${next_state.next_event_seq}`,
        event_type,
        signal_id: signal_envelope.signal_id,
        investor_id: signal_envelope.investor_id,
        product_id: signal_envelope.product_id,
        created_at: signal_envelope.received_at,
        payload,
      };
      next_state.next_event_seq += 1;
      appendAuditEvent(next_state, event);
      emitted_events.push(event);

      const effect: ILiveTradingEffect = {
        effect_id: `eff_${next_state.next_effect_seq}`,
        effect_type: 'emit_audit_event',
        payload: {
          audit_event: event,
        },
      };
      next_state.next_effect_seq += 1;
      planned_effects.push(effect);
    };

    const pushPlaceOrderEffect = (payload: Record<string, unknown>) => {
      const effect: ILiveTradingEffect = {
        effect_id: `eff_${next_state.next_effect_seq}`,
        effect_type: 'place_order',
        payload,
      };
      next_state.next_effect_seq += 1;
      planned_effects.push(effect);
    };

    const markSignalAsProcessed = () => {
      const snapshot: IProcessedSignalSnapshot = {
        signal_id: signal_envelope.signal_id,
        fingerprint,
        processed_at: signal_envelope.received_at,
      };
      upsertProcessedSignal(next_state, processed_signal_key, snapshot);
    };

    pushEvent('SignalAccepted', {
      source: signal_envelope.source,
    });

    if (signal_envelope.signal === 0) {
      const flat_plan = {
        position_direction: 'FLAT',
        target_notional: 0,
        target_volume: 0,
        stop_loss_price: 0,
        retain_min_lot: 0,
      };
      pushEvent('PositionPlanned', {
        plan: flat_plan,
      });

      const should_place_close_order = current_product_state.open_position_qty > 0;
      if (should_place_close_order) {
        pushPlaceOrderEffect({
          investor_id: signal_envelope.investor_id,
          product_id: signal_envelope.product_id,
          order_direction:
            current_product_state.position_direction === 'SHORT' ? 'CLOSE_SHORT' : 'CLOSE_LONG',
          volume: current_product_state.open_position_qty,
        });
        pushEvent('OrderSubmitted', {
          mode: 'close_only',
          target_volume: current_product_state.open_position_qty,
          target_notional: 0,
        });
      }

      if (current_investor) {
        next_state.investors[signal_envelope.investor_id] = {
          ...current_investor,
          last_signal_at: signal_envelope.received_at,
          products: {
            ...current_investor.products,
            [signal_envelope.product_id]: {
              ...current_product_state,
              last_signal_id: signal_envelope.signal_id,
              position_direction: 'FLAT',
              open_position_qty: 0,
              avg_entry_price: undefined,
            },
          },
        };
      }

      pushEvent('PositionFlattened', {
        previous_position_qty: current_product_state.open_position_qty,
      });
      markSignalAsProcessed();

      return {
        next_state,
        emitted_events,
        planned_effects,
      };
    }

    const sanitized_risk_policy = deepClone(risk_policy);
    validateRiskPolicy(sanitized_risk_policy);
    const existing_investor = state.investors[signal_envelope.investor_id];
    const effective_risk_policy = resolveEffectiveRiskPolicy(
      existing_investor,
      sanitized_risk_policy,
      signal_envelope,
    );
    const investor = getOrCreateInvestorState(state, signal_envelope.investor_id, effective_risk_policy);
    const investor_product_state = investor.products[signal_envelope.product_id] ?? current_product_state;
    const throttle = computeThrottleState(investor_product_state, signal_envelope, effective_risk_policy);
    const plan = computePositionPlan({
      signal: signal_envelope.signal,
      risk_policy: effective_risk_policy,
      entry_price,
    });

    pushEvent('PositionPlanned', {
      plan,
    });

    const next_product_state = {
      ...investor_product_state,
      last_signal_id: signal_envelope.signal_id,
    };

    const has_opposite_position =
      investor_product_state.open_position_qty > 0 &&
      investor_product_state.position_direction !== 'FLAT' &&
      investor_product_state.position_direction !== plan.position_direction;

    if (has_opposite_position) {
      pushPlaceOrderEffect({
        investor_id: signal_envelope.investor_id,
        product_id: signal_envelope.product_id,
        order_direction: investor_product_state.position_direction === 'SHORT' ? 'CLOSE_SHORT' : 'CLOSE_LONG',
        volume: investor_product_state.open_position_qty,
      });
      pushEvent('OrderSubmitted', {
        mode: 'close_before_open',
        target_volume: investor_product_state.open_position_qty,
        target_notional: 0,
      });
      pushEvent('PositionFlattened', {
        previous_position_qty: investor_product_state.open_position_qty,
        reason: 'close_then_open',
      });
    }

    pushPlaceOrderEffect({
      investor_id: signal_envelope.investor_id,
      product_id: signal_envelope.product_id,
      order_direction: signal_envelope.signal === 1 ? 'OPEN_LONG' : 'OPEN_SHORT',
      volume: plan.target_volume,
      stop_loss_price: plan.stop_loss_price,
      take_profit_price: plan.take_profit_price,
      target_notional: plan.target_notional,
    });
    pushEvent('OrderSubmitted', {
      mode: 'open',
      target_volume: plan.target_volume,
      target_notional: plan.target_notional,
    });

    const updated_investor: IInvestorState = {
      ...investor,
      policy_version: effective_risk_policy.policy_version,
      risk_policy: deepClone(effective_risk_policy),
      last_signal_at: signal_envelope.received_at,
      products: {
        ...investor.products,
        [signal_envelope.product_id]: {
          ...next_product_state,
          position_direction: plan.position_direction,
          open_position_qty: plan.target_volume,
          avg_entry_price: entry_price,
          recent_signal_timestamps: throttle.recent_signal_timestamps,
          cooling_until: throttle.cooling_until,
        },
      },
    };
    next_state.investors[signal_envelope.investor_id] = updated_investor;
    markSignalAsProcessed();

    return {
      next_state,
      emitted_events,
      planned_effects,
    };
  } catch (error) {
    const error_code = extractErrorCode(error);
    if (error_code === undefined || !AUDITED_REJECTION_ERROR_CODES.has(error_code)) {
      throw error;
    }
    return rejectWithAudit(state, signal_envelope, error_code, toRejectPayload(error));
  }
};

const AUDITED_REJECTION_ERROR_CODES = new Set<string>([
  'E_INVALID_SIGNAL_ENVELOPE',
  'E_RISK_POLICY_MISMATCH',
  'E_INVALID_RISK_POLICY',
  'E_INVALID_ENTRY_PRICE',
  'E_POSITION_VOLUME_TOO_SMALL',
  'E_UNSERIALIZABLE_INPUT',
  'E_COOLDOWN_ACTIVE',
  'E_RATE_LIMIT_EXCEEDED',
  'E_IDEMPOTENCY_CONFLICT',
]);

const rejectWithAudit = (
  state: ILiveTradingState,
  signal_envelope: ISignalEnvelope,
  error_code: string,
  details: Record<string, unknown>,
): IDispatchResult => {
  const next_state: ILiveTradingState = {
    ...state,
    investors: { ...state.investors },
    audit_events: [...state.audit_events],
    processed_signals: { ...state.processed_signals },
    next_event_seq: state.next_event_seq,
    next_effect_seq: state.next_effect_seq,
  };

  const event: IAuditEvent = {
    event_id: `evt_${next_state.next_event_seq}`,
    event_type: 'SignalRejected',
    signal_id: signal_envelope.signal_id || '__UNKNOWN_SIGNAL__',
    investor_id: signal_envelope.investor_id || '__UNKNOWN_INVESTOR__',
    product_id: signal_envelope.product_id || '__UNKNOWN_PRODUCT__',
    created_at: resolveAuditCreatedAt(signal_envelope.received_at),
    payload: {
      error_code,
      details,
    },
  };
  next_state.next_event_seq += 1;
  appendAuditEvent(next_state, event);

  const effect: ILiveTradingEffect = {
    effect_id: `eff_${next_state.next_effect_seq}`,
    effect_type: 'emit_audit_event',
    payload: {
      audit_event: event,
    },
  };
  next_state.next_effect_seq += 1;

  return {
    next_state,
    emitted_events: [event],
    planned_effects: [effect],
  };
};

const resolveAuditCreatedAt = (received_at: number) => {
  if (Number.isFinite(received_at) && received_at >= 0) {
    return received_at;
  }
  return Date.now();
};

const MAX_AUDIT_EVENTS = 10_000;
const MAX_PROCESSED_SIGNALS = 20_000;

const appendAuditEvent = (state: ILiveTradingState, event: IAuditEvent) => {
  state.audit_events.push(event);
  if (state.audit_events.length > MAX_AUDIT_EVENTS) {
    state.audit_events.splice(0, state.audit_events.length - MAX_AUDIT_EVENTS);
  }
};

const upsertProcessedSignal = (state: ILiveTradingState, key: string, snapshot: IProcessedSignalSnapshot) => {
  state.processed_signals[key] = snapshot;
  const keys = Object.keys(state.processed_signals);
  if (keys.length > MAX_PROCESSED_SIGNALS) {
    const overflow = keys.length - MAX_PROCESSED_SIGNALS;
    for (const stale_key of keys.slice(0, overflow)) {
      delete state.processed_signals[stale_key];
    }
  }
};

const extractErrorCode = (error: unknown): string | undefined => {
  if (!(error instanceof Error) || !error.message) {
    return undefined;
  }

  const separator_index = error.message.indexOf(':');
  const candidate = separator_index >= 0 ? error.message.slice(0, separator_index) : error.message;
  if (/^E_[A-Z0-9_]+$/.test(candidate)) {
    return candidate;
  }

  return undefined;
};

const toRejectPayload = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      error_message: error.message,
    };
  }

  return {
    error_message: String(error),
  };
};

const getOrCreateInvestorState = (
  state: ILiveTradingState,
  investor_id: string,
  risk_policy: IRiskPolicy,
): IInvestorState =>
  state.investors[investor_id] ?? {
    investor_id,
    policy_version: risk_policy.policy_version,
    risk_policy: deepClone(risk_policy),
    products: {},
  };

const resolveEffectiveRiskPolicy = (
  existing_investor: IInvestorState | undefined,
  incoming_risk_policy: IRiskPolicy,
  signal_envelope: ISignalEnvelope,
): IRiskPolicy => {
  if (!existing_investor) {
    return incoming_risk_policy;
  }

  const stored_fingerprint = stableStringify(existing_investor.risk_policy);
  const incoming_fingerprint = stableStringify(incoming_risk_policy);
  if (stored_fingerprint !== incoming_fingerprint) {
    throw newError('E_RISK_POLICY_MISMATCH', {
      investor_id: signal_envelope.investor_id,
      product_id: signal_envelope.product_id,
      signal_id: signal_envelope.signal_id,
      expected_policy_version: existing_investor.policy_version,
      incoming_policy_version: incoming_risk_policy.policy_version,
    });
  }

  return deepClone(existing_investor.risk_policy);
};

const computeThrottleState = (
  product_state: Pick<IInvestorState['products'][string], 'recent_signal_timestamps' | 'cooling_until'>,
  signal_envelope: ISignalEnvelope,
  risk_policy: IRiskPolicy,
) => {
  const window_start = signal_envelope.received_at - 60_000;
  const recent_signal_timestamps = (product_state.recent_signal_timestamps ?? []).filter(
    (ts) => ts >= window_start,
  );

  if (
    product_state.cooling_until !== undefined &&
    signal_envelope.received_at < product_state.cooling_until
  ) {
    throw newError('E_COOLDOWN_ACTIVE', {
      investor_id: signal_envelope.investor_id,
      product_id: signal_envelope.product_id,
      received_at: signal_envelope.received_at,
      cooling_until: product_state.cooling_until,
    });
  }

  if (recent_signal_timestamps.length >= risk_policy.rate_limit_per_minute) {
    throw newError('E_RATE_LIMIT_EXCEEDED', {
      investor_id: signal_envelope.investor_id,
      product_id: signal_envelope.product_id,
      rate_limit_per_minute: risk_policy.rate_limit_per_minute,
      window_start,
      received_at: signal_envelope.received_at,
    });
  }

  return {
    recent_signal_timestamps: [...recent_signal_timestamps, signal_envelope.received_at],
    cooling_until: signal_envelope.received_at + risk_policy.cooldown_seconds * 1000,
  };
};

const MAX_RECEIVED_AT_NOW_DRIFT_MS = 5 * 60 * 1000;

const validateSignalEnvelope = (signal_envelope: ISignalEnvelope, baseline_received_at?: number) => {
  if (!signal_envelope.signal_id) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', { field: 'signal_id' });
  }

  if (!signal_envelope.investor_id) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', { field: 'investor_id' });
  }

  if (!signal_envelope.product_id) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', { field: 'product_id' });
  }

  if (![1, 0, -1].includes(signal_envelope.signal)) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', { field: 'signal', value: signal_envelope.signal });
  }

  if (!['model', 'manual', 'agent'].includes(signal_envelope.source)) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', { field: 'source', value: signal_envelope.source });
  }

  if (!Number.isFinite(signal_envelope.received_at) || signal_envelope.received_at < 0) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', {
      field: 'received_at',
      value: signal_envelope.received_at,
      reason: 'non_finite_or_negative',
    });
  }

  if (Math.abs(signal_envelope.received_at - Date.now()) > MAX_RECEIVED_AT_NOW_DRIFT_MS) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', {
      field: 'received_at',
      value: signal_envelope.received_at,
      reason: 'too_far_from_now',
    });
  }

  if (baseline_received_at !== undefined && signal_envelope.received_at < baseline_received_at) {
    throw newError('E_INVALID_SIGNAL_ENVELOPE', {
      field: 'received_at',
      value: signal_envelope.received_at,
      baseline_received_at,
      reason: 'non_monotonic',
    });
  }
};

const buildProcessedSignalKey = (signal_envelope: ISignalEnvelope) => signal_envelope.signal_id;

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const walk = (current: unknown): string => {
    if (current === null || typeof current !== 'object') {
      return JSON.stringify(current);
    }

    if (Array.isArray(current)) {
      return `[${current.map((item) => walk(item)).join(',')}]`;
    }

    if (seen.has(current)) {
      throw newError('E_UNSERIALIZABLE_INPUT', { reason: 'circular_reference' });
    }
    seen.add(current);
    const entries = Object.entries(current as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    const serialized = `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${walk(val)}`).join(',')}}`;
    seen.delete(current);
    return serialized;
  };

  return walk(value);
};
