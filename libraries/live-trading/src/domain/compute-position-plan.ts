import { newError, roundToStep } from '@yuants/utils';
import { IPositionPlan, IRiskPolicy, TSignalValue } from '../types';

export interface IComputePositionPlanInput {
  signal: TSignalValue;
  risk_policy: IRiskPolicy;
  entry_price: number;
}

export const computePositionPlan = (input: IComputePositionPlanInput): IPositionPlan => {
  const { signal, risk_policy, entry_price } = input;
  validateRiskPolicy(risk_policy);
  if (!Number.isFinite(entry_price) || entry_price <= 0) {
    throw newError('E_INVALID_ENTRY_PRICE', { entry_price });
  }

  if (signal === 0) {
    return {
      position_direction: 'FLAT',
      target_notional: 0,
      target_volume: 0,
      stop_loss_price: 0,
      retain_min_lot: 0,
    };
  }

  const target_notional_raw = risk_policy.vc_budget / risk_policy.max_historical_drawdown_ratio;
  const target_notional = Math.min(target_notional_raw, risk_policy.max_notional_cap);
  const rounded_target_volume = roundToStep(target_notional / entry_price, risk_policy.min_lot, Math.floor);
  if (!Number.isFinite(rounded_target_volume) || rounded_target_volume <= 0) {
    throw newError('E_POSITION_VOLUME_TOO_SMALL', {
      target_notional,
      entry_price,
      min_lot: risk_policy.min_lot,
    });
  }

  const stop_loss_price =
    signal === 1
      ? entry_price * (1 - risk_policy.max_historical_drawdown_ratio)
      : entry_price * (1 + risk_policy.max_historical_drawdown_ratio);

  return {
    position_direction: signal === 1 ? 'LONG' : 'SHORT',
    target_notional,
    target_volume: rounded_target_volume,
    stop_loss_price,
    take_profit_price: computeTakeProfitPrice(signal, entry_price, rounded_target_volume, risk_policy),
    retain_min_lot: risk_policy.min_lot,
  };
};

export const validateRiskPolicy = (risk_policy: IRiskPolicy) => {
  if (!risk_policy.policy_version) {
    throw newError('E_INVALID_RISK_POLICY', { reason: 'policy_version_required' });
  }

  if (!Number.isFinite(risk_policy.vc_budget) || risk_policy.vc_budget <= 0) {
    throw newError('E_INVALID_RISK_POLICY', { field: 'vc_budget', value: risk_policy.vc_budget });
  }

  if (
    !Number.isFinite(risk_policy.max_historical_drawdown_ratio) ||
    risk_policy.max_historical_drawdown_ratio <= 0 ||
    risk_policy.max_historical_drawdown_ratio > 1
  ) {
    throw newError('E_INVALID_RISK_POLICY', {
      field: 'max_historical_drawdown_ratio',
      value: risk_policy.max_historical_drawdown_ratio,
    });
  }

  if (!Number.isFinite(risk_policy.min_lot) || risk_policy.min_lot <= 0) {
    throw newError('E_INVALID_RISK_POLICY', { field: 'min_lot', value: risk_policy.min_lot });
  }

  if (!Number.isFinite(risk_policy.rate_limit_per_minute) || risk_policy.rate_limit_per_minute < 1) {
    throw newError('E_INVALID_RISK_POLICY', {
      field: 'rate_limit_per_minute',
      value: risk_policy.rate_limit_per_minute,
    });
  }

  if (!Number.isFinite(risk_policy.cooldown_seconds) || risk_policy.cooldown_seconds < 0) {
    throw newError('E_INVALID_RISK_POLICY', {
      field: 'cooldown_seconds',
      value: risk_policy.cooldown_seconds,
    });
  }

  if (!Number.isFinite(risk_policy.max_notional_cap) || risk_policy.max_notional_cap <= 0) {
    throw newError('E_INVALID_RISK_POLICY', {
      field: 'max_notional_cap',
      value: risk_policy.max_notional_cap,
    });
  }
};

const computeTakeProfitPrice = (
  signal: TSignalValue,
  entry_price: number,
  target_volume: number,
  risk_policy: IRiskPolicy,
) => {
  if (signal === 0) return undefined;
  if (risk_policy.take_profit_ratio !== undefined && risk_policy.take_profit_amount !== undefined) {
    throw newError('E_INVALID_RISK_POLICY', {
      reason: 'take_profit_ratio_and_amount_conflict',
      take_profit_ratio: risk_policy.take_profit_ratio,
      take_profit_amount: risk_policy.take_profit_amount,
    });
  }

  if (risk_policy.take_profit_ratio !== undefined) {
    if (!Number.isFinite(risk_policy.take_profit_ratio) || risk_policy.take_profit_ratio <= 0) {
      throw newError('E_INVALID_RISK_POLICY', {
        field: 'take_profit_ratio',
        value: risk_policy.take_profit_ratio,
      });
    }
    return signal === 1
      ? entry_price * (1 + risk_policy.take_profit_ratio)
      : entry_price * (1 - risk_policy.take_profit_ratio);
  }

  if (risk_policy.take_profit_amount !== undefined) {
    if (!Number.isFinite(risk_policy.take_profit_amount) || risk_policy.take_profit_amount <= 0) {
      throw newError('E_INVALID_RISK_POLICY', {
        field: 'take_profit_amount',
        value: risk_policy.take_profit_amount,
      });
    }

    const delta_price = risk_policy.take_profit_amount / target_volume;
    return signal === 1 ? entry_price + delta_price : entry_price - delta_price;
  }

  return undefined;
};
