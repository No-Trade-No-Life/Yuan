export interface IAccountRiskInfo {
  /**
   * The account ID
   */
  account_id: string;
  /**
   * The currency under the account
   */
  currency: string;
  /**
   * The group ID
   *
   * Accounts with the same group ID can transfer to each other
   */
  group_id: string;
  /**
   * The active supply threshold
   *
   * if equity is greater than this value, the account will actively transfer to the demand-side accounts
   *
   * if undefined, active supply is disabled
   */
  active_supply_threshold?: number | null;
  /**
   * The active supply leverage
   *
   * if actual_leverage is less than this value, the account will actively transfer to the demand-side accounts
   *
   * if undefined, active supply leverage is disabled
   */
  active_supply_leverage?: number | null;
  /**
   * The passive supply threshold
   *
   * if equity is greater than this value, the account will passively transfer to the demand-side accounts
   *
   * if undefined, passive supply is disabled
   */
  passive_supply_threshold?: number | null;
  /**
   * The passive supply leverage
   *
   * if actual_leverage is less than this value, the account will passively transfer to the demand-side accounts
   *
   * if undefined, passive supply leverage is disabled
   */
  passive_supply_leverage?: number | null;
  /**
   * The active demand threshold
   *
   * if equity is less than this value, the account will actively transfer from the supply-side accounts
   *
   * if undefined, active demand is disabled
   */
  active_demand_threshold?: number | null;

  /**
   * The active demand leverage
   *
   * if actual_leverage is greater than this value, the account will actively transfer from the supply-side accounts
   *
   * if undefined, active demand leverage is disabled
   */
  active_demand_leverage?: number | null;
  /**
   * The passive demand threshold
   *
   * if equity is less than this value, the account will passively transfer from the supply-side accounts
   *
   * if undefined, passive demand is disabled
   */
  passive_demand_threshold?: number | null;
  /**
   * The passive demand leverage
   *
   * if actual_leverage is greater than this value, the account will passively transfer from the supply-side accounts
   *
   * if undefined, passive demand leverage is disabled
   */
  passive_demand_leverage?: number | null;

  /**
   * Minimum free money threshold
   *
   * if free margin is less than this value, the account will be actively transferred from the supply-side accounts
   *
   * and both the passive_supply and active_supply will deduce this value
   *
   * useful for preventing the account from being no free money to open a new position or transfer-out
   *
   * if undefined, minimum free is disabled
   */
  minimum_free?: number | null;
  /**
   * whether this info is disabled
   */
  disabled?: boolean | null;
}
