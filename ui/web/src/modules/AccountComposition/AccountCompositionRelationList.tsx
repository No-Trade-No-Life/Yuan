import { createColumnHelper } from '@tanstack/react-table';
import { formatTime } from '@yuants/utils';
import { InlineAccountId } from '../AccountInfo';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';

/**
 * Account Composition Relation
 *
 * target account is composed by source accounts.
 * the multiple is applied to the source account.
 * and then sum up to the target account.
 *
 * @public
 */
interface IAccountCompositionRelation {
  source_account_id: string;
  target_account_id: string;
  multiple: number;
  hide_positions?: boolean;
  created_at: string;
  updated_at: string;
}

registerPage('AccountCompositionRelationList', () => {
  return (
    <DataRecordView
      TYPE={'account_composition_relation'}
      columns={() => {
        const columnHelper = createColumnHelper<IAccountCompositionRelation>();
        return [
          columnHelper.accessor('target_account_id', {
            header: () => '目标账户',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('source_account_id', {
            header: () => '原账户',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('multiple', {
            header: () => '乘数',
          }),
          columnHelper.accessor('created_at', {
            header: () => '创建时间',
            cell: (ctx) => formatTime(ctx.getValue()),
          }),
          columnHelper.accessor('updated_at', {
            header: () => '更新时间',
            cell: (ctx) => formatTime(ctx.getValue()),
          }),
        ];
      }}
    />
  );
});
