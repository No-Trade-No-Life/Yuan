import { JSONSchema7 } from 'json-schema';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    account_composition_relation: IAccountCompositionRelation;
  }
}

/**
 * Account Composition Relation
 *
 * target account is composed by source accounts.
 * the multiple is applied to the source account.
 * and then sum up to the target account.
 */
export interface IAccountCompositionRelation {
  source_account_id: string;
  target_account_id: string;
  multiple: number;
}

export const acrSchema: JSONSchema7 = {
  type: 'object',
  required: ['source_account_id', 'target_account_id', 'multiple'],
  properties: {
    source_account_id: {
      type: 'string',
    },
    target_account_id: {
      type: 'string',
    },
    multiple: {
      type: 'number',
    },
  },
};
