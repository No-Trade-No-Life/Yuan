export interface ComputeTargetPositionInput {
  signal: -1 | 1;
  vc_budget: number;
  entry_price: number;
  stop_loss_price: number;
  contract_multiplier?: number;
  lot_size?: number;
}

const ensurePositiveFinite = (value: number, name: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name.toUpperCase()}_INVALID`);
  }
};

export const validateRiskInputs = (input: ComputeTargetPositionInput) => {
  ensurePositiveFinite(input.vc_budget, 'vc_budget');
  ensurePositiveFinite(input.entry_price, 'entry_price');
  ensurePositiveFinite(input.stop_loss_price, 'stop_loss_price');
  ensurePositiveFinite(input.contract_multiplier ?? 1, 'contract_multiplier');
  ensurePositiveFinite(input.lot_size ?? 1, 'lot_size');

  if (input.signal === 1 && input.stop_loss_price >= input.entry_price) {
    throw new Error('STOP_LOSS_INVALID_FOR_LONG');
  }

  if (input.signal === -1 && input.stop_loss_price <= input.entry_price) {
    throw new Error('STOP_LOSS_INVALID_FOR_SHORT');
  }
};

const floorToLot = (value: number, lot_size: number): number => {
  return Math.floor(value / lot_size) * lot_size;
};

export const computeTargetPosition = (input: ComputeTargetPositionInput): number => {
  validateRiskInputs(input);

  const contract_multiplier = input.contract_multiplier ?? 1;
  const lot_size = input.lot_size ?? 1;
  const risk_per_unit = Math.abs(input.entry_price - input.stop_loss_price) * contract_multiplier;
  const qty = floorToLot(input.vc_budget / risk_per_unit, lot_size);

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('VC_INSUFFICIENT');
  }

  return qty * input.signal;
};
