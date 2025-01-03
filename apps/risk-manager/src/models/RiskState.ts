export interface IRiskState {
  currency: string;
  group_id: string;
  account_id: string;
  equity: number;
  free: number;
  valuation: number;
  active_supply: number;
  active_demand: number;
  passive_supply: number;
  passive_demand: number;
}
