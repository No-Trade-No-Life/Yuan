import { IconArrowUp } from '@douyinfe/semi-icons';
import { Avatar, Button, Descriptions, Space, Toast } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { executeCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { registerPage, usePageId } from '../Pages';
import { authState$, supabase } from '../SupaBase';

registerPage('UserProfile', () => {
  const { t } = useTranslation('UserProfile');
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
              key: t('common:YuanCoin'),
              value: (
                <Space>
                  {balance}{' '}
                  <Button
                    onClick={async () => {
                      const volume = await showForm({ type: 'number' });
                      const res = await supabase
                        .from('order')
                        .insert({
                          volume: volume,
                        })
                        .select();
                      if (res.error) {
                        Toast.error(`${res.error.code}: ${res.error.message}`);
                      }
                      if (res.data?.[0]) {
                        Toast.success(`Succ: ${res.data?.[0].id}`);
                      }
                    }}
                  >
                    充值
                  </Button>
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
