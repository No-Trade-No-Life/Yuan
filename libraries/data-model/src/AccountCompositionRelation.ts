/**
 * Account Composition Relation
 *
 * target account is composed by source accounts.
 * the multiple is applied to the source account.
 * and then sum up to the target account.
 *
 * @public
 */
export interface IAccountCompositionRelation {
  source_account_id: string;
  target_account_id: string;
  multiple: number;
  hide_positions?: boolean;
}
