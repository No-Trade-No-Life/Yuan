import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, IDataRecordTypes } from '@yuants/data-model';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { terminate } from '../Terminals/TerminalListItem';

registerPage('AccountCompositionRelationList', () => {
  return (
    <DataRecordView
      TYPE={'account_composition_relation'}
      columns={() => {
        const columnHelper =
          createColumnHelper<IDataRecord<IDataRecordTypes['account_composition_relation']>>();
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
      extraHeaderActions={(props) => {
        return (
          <Button icon={<IconRefresh />} onClick={() => executeCommand('AccountComposer.Restart')}>
            重启合成器
          </Button>
        );
      }}
    />
  );
});

registerCommand('AccountComposer.Restart', () => {
  terminate('AccountComposer');
});
