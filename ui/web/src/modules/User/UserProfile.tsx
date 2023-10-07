import { IconArrowUp } from '@douyinfe/semi-icons';
import { Avatar, Button, Descriptions, Space } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { executeCommand } from '../CommandCenter';
import { registerPage, usePageId } from '../Pages';
import { authState$, supabase } from '../SupaBase';

registerPage('UserProfile', () => {
  const authState = useObservableState(authState$);
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    supabase
      .from('wallet')
      .select()
      .then((res) => {
        const balance = res.data?.[0].balance;
        if (balance) {
          setBalance(balance);
        }
      });
  }, []);

  const pageId = usePageId();

  useEffect(() => {
    if (!authState) {
      executeCommand('Login');
      executeCommand('Page.close', { pageId });
    }
  }, [authState]);

  return (
    <Space vertical align="start" style={{ padding: '2em' }}>
      <Space>
        <Avatar size="large" src={authState?.user.user_metadata.avatar_url}></Avatar>
        {authState?.user.user_metadata.name} ({authState?.user.email})
      </Space>
      <Space>
        <Descriptions
          row
          data={[
            {
              key: '会员',
              value: (
                <Space>
                  {'普通'} <Button icon={<IconArrowUp />}>升级</Button>
                </Space>
              ),
            },
            {
              key: '原石',
              value: (
                <Space>
                  {balance} <Button>充值</Button>
                </Space>
              ),
            },
          ]}
        ></Descriptions>
      </Space>
      {/* <pre>{JSON.stringify(authState, null, 2)}</pre> */}
    </Space>
  );
});
