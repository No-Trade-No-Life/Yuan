/** @public */
export type TSignalValue = -1 | 0 | 1;

/** @public */
export interface ISignalEnvelope {
  signal_id: string;
  investor_id: string;
  product_id: string;
  signal: TSignalValue;
  source: 'model' | 'manual' | 'agent';
  received_at: number;
  metadata?: Record<string, string>;
}

/** @public */
export interface IRiskPolicy {
  policy_version: string;
  vc_budget: number;
  max_historical_drawdown_ratio: number;
  take_profit_ratio?: number;
  take_profit_amount?: number;
  min_lot: number;
  rate_limit_per_minute: number;
  cooldown_seconds: number;
  max_notional_cap: number;
}

/** @public */
export interface IPositionPlan {
  position_direction: 'LONG' | 'SHORT' | 'FLAT';
  target_notional: number;
  target_volume: number;
  stop_loss_price: number;
  take_profit_price?: number;
  retain_min_lot: number;
}

/** @public */
export interface IInvestorProductState {
  product_id: string;
  position_direction: 'LONG' | 'SHORT' | 'FLAT';
  open_position_qty: number;
  avg_entry_price?: number;
  last_signal_id?: string;
  recent_signal_timestamps?: number[];
  cooling_until?: number;
}

/** @public */
export interface IInvestorState {
  investor_id: string;
  policy_version: string;
  risk_policy: IRiskPolicy;
  products: Record<string, IInvestorProductState>;
  last_signal_at?: number;
}

/** @public */
export interface ILiveTradingEffect {
  effect_id: string;
  effect_type: 'place_order' | 'emit_audit_event';
  payload: Record<string, unknown>;
}

/** @public */
export interface IAuditEvent {
  event_id: string;
  event_type:
    | 'SignalAccepted'
    | 'SignalRejected'
    | 'PositionPlanned'
    | 'PositionFlattened'
    | 'OrderSubmitted'
    | 'RiskPolicyUpdated';
  signal_id: string;
  investor_id: string;
  product_id: string;
  created_at: number;
  payload: Record<string, unknown>;
}

/** @public */
export interface IProcessedSignalSnapshot {
  signal_id: string;
  fingerprint: string;
  processed_at: number;
}

/** @public */
export interface ILiveTradingState {
  schema_version: string;
  investors: Record<string, IInvestorState>;
  audit_events: IAuditEvent[];
  processed_signals: Record<string, IProcessedSignalSnapshot>;
  next_event_seq: number;
  next_effect_seq: number;
}

/** @public */
export interface ISubmitSignalCommandPayload {
  signal_envelope: ISignalEnvelope;
  risk_policy: IRiskPolicy;
  entry_price: number;
}

/** @public */
export interface IUpdateRiskPolicyCommandPayload {
  investor_id: string;
  risk_policy: IRiskPolicy;
}

/** @public */
export type TLiveTradingCommand =
  | {
      command_type: 'submit_signal';
      payload: ISubmitSignalCommandPayload;
    }
  | {
      command_type: 'update_risk_policy';
      payload: IUpdateRiskPolicyCommandPayload;
    };

/** @public */
export interface IDispatchResult {
  next_state: ILiveTradingState;
  emitted_events: IAuditEvent[];
  planned_effects: ILiveTradingEffect[];
}

/** @public */
export interface IQueryInvestorStateRequest {
  investor_id: string;
}

/** @public */
export interface IQueryAuditTrailRequest {
  investor_id?: string;
  signal_id?: string;
  from_ms: number;
  to_ms: number;
}
