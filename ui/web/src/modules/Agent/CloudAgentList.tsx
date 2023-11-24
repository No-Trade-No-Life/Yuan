import { IconDelete, IconEyeOpened, IconRefresh } from '@douyinfe/semi-icons';
import { Button, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IAgentConf } from '@yuants/agent';
import { formatTime } from '@yuants/data-model';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { Subject, defer, repeat, shareReplay } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { resolveVersion } from '../Extensions';
import { registerPage } from '../Pages';
import { supabase } from '../SupaBase';
import { secretURL } from '../Terminals/NetworkStatusWidget';
import { currentHostConfig$ } from '../Workbench/model';
import { agentConf$ } from './AgentConfForm';
import { bundleCode } from './utils';

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

registerCommand('Agent.DeployToCloud', async ({ agentConf }: { agentConf: IAgentConf }) => {
  const { version } = await resolveVersion('@yuants/app-agent');
  const bundled_code = await bundleCode(agentConf.entry || '');
  const res = await supabase.from('agent').insert({
    host_url: currentHostConfig$.value?.host_url,
    kernel_id: agentConf.kernel_id ?? 'Model',
    version: version,
    one_json: {
      //
      ...agentConf,
      is_real: true,
      bundled_code: bundled_code,
    },
  });
  if (res.error) {
    Toast.error(`${t('common:failed')}: ${res.error.code} ${res.error.message}`);
    return;
  }
  Toast.success(`${t('common:succeed')}: ${agentConf.kernel_id}`);
  executeCommand('CloudAgentList');
});
