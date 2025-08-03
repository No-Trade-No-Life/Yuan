import { IAccountInfo } from '@yuants/data-account';
import { IAccountRiskInfo } from '../models';
import { IRiskState } from '../models/RiskState';

export const resolveRiskState = (riskInfo: IAccountRiskInfo, accountInfo: IAccountInfo): IRiskState => {
  const state: IRiskState = {
    account_id: riskInfo.account_id,
    currency: riskInfo.currency,
    group_id: riskInfo.group_id,
    equity: NaN,
    free: NaN,
    valuation: NaN,
    active_demand: NaN,
    passive_demand: NaN,
    passive_supply: NaN,
    active_supply: NaN,
  };
  const currencyItem = accountInfo.currencies.find((x) => x.currency === riskInfo.currency);
  state.equity = currencyItem?.equity ?? 0;
  state.free = currencyItem?.free ?? 0;
  // TODO: add filter currency for positions
  state.valuation = accountInfo.positions.reduce((acc, x) => acc + x.valuation, 0);

  // Calculate Active Supply
  if (riskInfo.active_supply_threshold != null || riskInfo.active_supply_leverage != null) {
    const resolved_threshold = Math.min(
      riskInfo.active_supply_threshold ? riskInfo.active_supply_threshold : Infinity,
      riskInfo.active_supply_leverage ? state.valuation / riskInfo.active_supply_leverage : Infinity,
    );
    state.active_supply = Math.max(
      Math.min(
        state.equity - resolved_threshold,
        state.free - (riskInfo.minimum_free != null ? riskInfo.minimum_free : 0),
      ),
      0,
    );
  }
  // Calculate Passive Supply
  if (riskInfo.passive_supply_threshold != null || riskInfo.passive_supply_leverage != null) {
    const resolved_threshold = Math.min(
      riskInfo.passive_supply_threshold != null ? riskInfo.passive_supply_threshold : Infinity,
      riskInfo.passive_supply_leverage != null
        ? state.valuation / riskInfo.passive_supply_leverage
        : Infinity,
    );
    state.passive_supply = Math.max(
      Math.min(
        state.equity - resolved_threshold,
        state.free - (riskInfo.minimum_free != null ? riskInfo.minimum_free : 0),
      ),
      0,
    );
  }

  // Calculate Active Demand
  if (riskInfo.active_demand_threshold != null || riskInfo.active_demand_leverage != null) {
    const resolved_threshold = Math.max(
      riskInfo.active_demand_threshold != null ? riskInfo.active_demand_threshold : -Infinity,
      riskInfo.active_demand_leverage != null ? state.valuation / riskInfo.active_demand_leverage : -Infinity,
      // candidate for minimum free
      riskInfo.minimum_free != null
        ? state.equity + Math.max(0, riskInfo.minimum_free - state.free)
        : -Infinity,
    );

    state.active_demand = Math.max(resolved_threshold - state.equity, 0);
  }

  // Calculate Passive Demand
  if (riskInfo.passive_demand_threshold != null || riskInfo.passive_demand_leverage != null) {
    const resolved_threshold = Math.max(
      riskInfo.passive_demand_threshold != null ? riskInfo.passive_demand_threshold : -Infinity,
      riskInfo.passive_demand_leverage != null
        ? state.valuation / riskInfo.passive_demand_leverage
        : -Infinity,
      // candidate for minimum free
      riskInfo.minimum_free != null
        ? state.equity + Math.max(0, riskInfo.minimum_free - state.free)
        : -Infinity,
    );
    state.passive_demand = Math.max(resolved_threshold - state.equity, 0);
  }

  return state;
};
