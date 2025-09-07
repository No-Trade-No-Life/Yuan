import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { ITradeCopierTradeConfig } from './interface';

registerPage('TradeConfigList', () => {
  return (
    <DataRecordView
      TYPE="trade_copier_trade_config"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<ITradeCopierTradeConfig>();
        return [
          columnHelper.accessor('account_id', {
            header: () => '账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('product_id', {
            header: () => '品种 ID',
          }),
          columnHelper.accessor('max_volume_per_order', {
            header: () => '每单最大手数',
          }),
        ];
      }}
      extraHeaderActions={() => {
        return (
          <Button icon={<IconRefresh />} onClick={() => executeCommand('TradeCopier.Restart')}>
            重启跟单阵列
          </Button>
        );
      }}
    />
  );
});
