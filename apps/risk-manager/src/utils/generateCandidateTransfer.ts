import { IRiskState } from '../models/RiskState';

export function* generateCandidateTransfer(
  list: IRiskState[],
): Generator<{ credit: string; debit: string; amount: number; currency: string } | undefined, void, void> {
  const demandList = [...list].sort((a, b) => b.passive_demand - a.passive_demand);
  const supplyList = [...list].sort((a, b) => b.passive_supply - a.passive_supply);
  // Active Demand
  for (const demandSide of list) {
    if (demandSide.active_demand > 0) {
      for (const supplySide of supplyList) {
        if (demandSide.account_id === supplySide.account_id) continue;
        // Active Demand match Active Supply
        if (supplySide.active_supply > 0) {
          // Assert that passive_supply > active_supply
          yield {
            credit: supplySide.account_id,
            debit: demandSide.account_id,
            currency: supplySide.currency,
            amount: Math.floor(Math.min(demandSide.passive_demand, supplySide.passive_supply)),
          };
        }
      }
      for (const supplySide of supplyList) {
        if (demandSide.account_id === supplySide.account_id) continue;
        if (supplySide.passive_supply > 0) {
          yield {
            credit: supplySide.account_id,
            debit: demandSide.account_id,
            currency: supplySide.currency,
            amount: Math.floor(Math.min(demandSide.passive_demand, supplySide.passive_supply)),
          };
        }
      }
    }
  }

  // Active Supply
  for (const supplySide of list) {
    if (supplySide.active_supply > 0) {
      for (const demandSide of demandList) {
        if (demandSide.account_id === supplySide.account_id) continue;
        if (supplySide.active_demand > 0) {
          yield {
            credit: supplySide.account_id,
            debit: demandSide.account_id,
            currency: supplySide.currency,
            amount: Math.floor(Math.min(demandSide.passive_demand, supplySide.passive_supply)),
          };
        }
      }
      for (const demandSide of demandList) {
        if (demandSide.account_id === supplySide.account_id) continue;
        if (demandSide.passive_demand > 0) {
          yield {
            credit: supplySide.account_id,
            debit: demandSide.account_id,
            currency: supplySide.currency,
            amount: Math.floor(Math.min(demandSide.passive_demand, supplySide.passive_supply)),
          };
        }
      }
    }
  }
}
