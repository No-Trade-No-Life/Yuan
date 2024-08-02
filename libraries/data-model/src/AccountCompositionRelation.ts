import { addDataRecordSchema, addDataRecordWrapper } from './DataRecord';
import { UUID } from './utils';

declare module './DataRecord' {
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
 *
 */
interface IAccountCompositionRelation {
  source_account_id: string;
  target_account_id: string;
  multiple: number;
}

addDataRecordWrapper('account_composition_relation', (x) => {
  const id = UUID();
  return {
    id,
    type: 'account_composition_relation',
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: x,
  };
});

addDataRecordSchema('account_composition_relation', {
  type: 'object',
  required: ['source_account_id', 'target_account_id', 'multiple'],
  properties: {
    source_account_id: {
      type: 'string',
      format: 'account_id',
    },
    target_account_id: {
      type: 'string',
      format: 'account_id',
    },
    multiple: {
      type: 'number',
    },
  },
});
