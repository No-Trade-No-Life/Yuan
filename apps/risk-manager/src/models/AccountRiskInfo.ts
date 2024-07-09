import { IDataRecord, encodePath } from '@yuants/data-model';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    account_risk_info: IAccountRiskInfo;
  }
}

export interface IAccountRiskInfo {
  /**
   * The account ID
   */
  account_id: string;
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
  active_supply_threshold?: number;
  /**
   * The passive supply threshold
   *
   * if equity is greater than this value, the account will passively transfer to the demand-side accounts
   *
   * if undefined, passive supply is disabled
   */
  passive_supply_threshold?: number;
  /**
   * The active demand threshold
   *
   * if equity is less than this value, the account will actively transfer from the supply-side accounts
   *
   * if undefined, active demand is disabled
   */
  active_demand_threshold?: number;
  /**
   * The passive demand threshold
   *
   * if equity is less than this value, the account will passively transfer from the supply-side accounts
   *
   * if undefined, passive demand is disabled
   */
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
