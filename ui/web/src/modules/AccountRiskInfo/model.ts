import { JSONSchema7 } from 'json-schema';

/**
 * Account Composition Relation
 *
 * target account is composed by source accounts.
 * the multiple is applied to the source account.
 * and then sum up to the target account.
 */
export interface IAccountRiskInfo {
  source_account_id: string;
  target_account_id: string;
  multiple: number;
}
