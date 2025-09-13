import { Space } from '@douyinfe/semi-ui';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { memo } from 'react';
import { firstValueFrom } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { showForm } from '../Form';
import { Button, Toast } from '../Interactive';
import { terminal$ } from '../Network';
import { ITradeCopierConfig } from './interface';
import { schemaOfTradeCopierConfig } from './schema';

export const TradeCopierDetail = memo((props: { account_id: string }) => {
  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          onClick={async () => {
            const terminal = await firstValueFrom(terminal$);
            if (!terminal) return;
            const data = await requestSQL<ITradeCopierConfig[]>(
              terminal,
              `select * from trade_copier_config where account_id=${escapeSQL(props.account_id)}`,
            );
            const config = data[0] || { account_id: props.account_id };
            const nextConfig = await showForm<ITradeCopierConfig>(schemaOfTradeCopierConfig, config);
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL([nextConfig], 'trade_copier_config', {
                conflictKeys: ['account_id'],
              }),
            );
            Toast.success('编辑跟单配置成功');
          }}
        >
          编辑跟单配置
        </Button>
        <Button>发布预览账户至预期账户</Button>
        <Button onClick={async () => {}}>编辑预览账户</Button>
      </Space>
      <div>
        预期账户: <InlineAccountId account_id={`TradeCopier/Expected/${props.account_id}`} />
      </div>
      <div>
        预览账户: <InlineAccountId account_id={`TradeCopier/Preview/${props.account_id}`} />
      </div>
    </Space>
  );
});
