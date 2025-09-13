import { Space } from '@douyinfe/semi-ui';
import { memo } from 'react';
import { InlineAccountId } from '../AccountInfo';
import { Button } from '../Interactive';

export const TradeCopierDetail = memo((props: { account_id: string }) => {
  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Button>发布预览账户至预期账户</Button>
      <Button onClick={async () => {}}>编辑预览账户</Button>
      <div>
        预期账户: <InlineAccountId account_id={`TradeCopier/Expected/${props.account_id}`} />
      </div>
      <div>
        预览账户: <InlineAccountId account_id={`TradeCopier/Preview/${props.account_id}`} />
      </div>
    </Space>
  );
});
