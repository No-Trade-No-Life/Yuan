import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecordTypes } from '@yuants/data-model';
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
        const columnHelper = createColumnHelper<IDataRecordTypes['account_composition_relation']>();
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
        ];
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
