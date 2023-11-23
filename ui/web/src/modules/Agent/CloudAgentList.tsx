import { IconDelete, IconEyeOpened, IconRefresh } from '@douyinfe/semi-icons';
import { Button, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IAgentConf } from '@yuants/agent';
import { formatTime } from '@yuants/data-model';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { Subject, defer, repeat, shareReplay } from 'rxjs';
import { registerPage } from '../Pages';
import { supabase } from '../SupaBase';
import { secretURL } from '../Terminals/NetworkStatusWidget';
import { agentConf$ } from './AgentConfForm';

const refreshAction$ = new Subject<void>();

const agents$ = defer(async () => {
  const res = await supabase.from('agent').select('*');
  const data: Array<{
    id: string;
    created_at: string;
    one_json: IAgentConf;
    kernel_id: string;
    version: string;
    host_id: string;
    host_url: string;
    user_id: string;
  }> = res.data || [];
  return data;
}).pipe(
  //

  repeat({ delay: () => refreshAction$ }),
  shareReplay(1),
);

registerPage('CloudAgentList', () => {
  const data = useObservableState(agents$);

  return (
    <Space vertical align="start">
      <Space>
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            refreshAction$.next();
          }}
        ></Button>
      </Space>
      <Table
        dataSource={data}
        columns={[
          //
          {
            title: 'Kernel ID',
            render: (_, v) => v.kernel_id,
          },
          {
            title: 'Host URL',
            render: (_, v) => (
              <Typography.Text copyable={{ content: v.host_url }}>{secretURL(v.host_url)}</Typography.Text>
            ),
          },
          {
            title: 'Version',
            render: (_, v) => v.version,
          },
          {
            title: 'Created At',
            render: (_, v) => formatTime(new Date(v.created_at).getTime()),
          },
          {
            title: 'Actions',
            render: (_, v) => (
              <Space>
                <Button
                  icon={<IconEyeOpened />}
                  onClick={() => {
                    agentConf$.next(v.one_json);
                  }}
                >
                  {t('common:open')}
                </Button>
                <Button
                  type="danger"
                  icon={<IconDelete />}
                  onClick={async () => {
                    await supabase.from('agent').delete().eq('id', v.id);
                    refreshAction$.next();
                    Toast.success(t('common:succeed'));
                  }}
                >
                  {t('common:delete')}
                </Button>
              </Space>
            ),
          },
        ]}
      ></Table>
    </Space>
  );
});
