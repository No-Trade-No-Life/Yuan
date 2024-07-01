import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, UUID } from '@yuants/data-model';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { terminate } from '../Terminals/TerminalListItem';
import { IAccountCompositionRelation, acrSchema } from './model';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    account_composition_relation: IAccountCompositionRelation;
  }
}

const TYPE = 'account_composition_relation';

const mapTradeCopyRelationToDataRecord = (
  x: IAccountCompositionRelation,
): IDataRecord<IAccountCompositionRelation> => {
  const id = UUID();
  return {
    id,
    type: TYPE,
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: x,
  };
};

registerPage('AccountCompositionRelationList', () => {
  return (
    <DataRecordView
      TYPE={TYPE}
      columns={() => {
        const columnHelper = createColumnHelper<IDataRecord<IAccountCompositionRelation>>();
        return [
          columnHelper.accessor('origin.target_account_id', {
            header: () => '目标账户',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.source_account_id', {
            header: () => '原账户',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.multiple', {
            header: () => '乘数',
          }),
        ];
      }}
      newRecord={() => {
        return {};
      }}
      mapOriginToDataRecord={mapTradeCopyRelationToDataRecord}
      extraHeaderActions={(props) => {
        return (
          <Button icon={<IconRefresh />} onClick={() => executeCommand('AccountComposer.Restart')}>
            重启合成器
          </Button>
        );
      }}
      schema={acrSchema}
    />
  );
});

registerCommand('AccountComposer.Restart', () => {
  terminate('AccountComposer');
});
