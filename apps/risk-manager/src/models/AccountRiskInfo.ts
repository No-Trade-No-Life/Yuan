import { IDataRecord, encodePath } from '@yuants/data-model';

export interface IAccountRiskInfo {
  /**
   * The account ID
   */
  account_id: string;
  group_id: string;
  /**
   * The active supply threshold
   *
   * if equity is greater than this value, the account will actively transfer to the demand-side accounts
   *
   * The maximum value to transfer is `active_supply_threshold - passive_supply_threshold`
   *
   * if undefined, active supply is disabled
   */
  active_supply_threshold?: number;
  passive_supply_threshold?: number;
  active_demand_threshold?: number;
  passive_demand_threshold?: number;
  /**
   * whether this info is disabled
   */
  disabled?: boolean;
}

export const wrapAccountRiskInfo = (x: IAccountRiskInfo): IDataRecord<IAccountRiskInfo> => {
  return {
    type: 'account_risk_info',
    id: encodePath(x.group_id, x.account_id),
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {
      group_id: x.group_id,
      account_id: x.account_id,
    },
    origin: x,
  };
};
