import { IconDelete, IconEyeOpened, IconRefresh } from '@douyinfe/semi-icons';
import { Button, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IAgentConf } from '@yuants/agent';
import { formatTime } from '@yuants/data-model';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { Subject, defer, firstValueFrom, repeat, shareReplay } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { resolveVersion } from '../Extensions';
import { showForm } from '../Form';
import { shareHosts$ } from '../Host/model';
import i18n from '../Locale/i18n';
import { registerPage } from '../Pages';
import { supabase } from '../SupaBase';
import { ensureAuthenticated } from '../User';
import { secretURL } from '../Workbench/HostList';
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
  await ensureAuthenticated();
  const { version } = await resolveVersion('@yuants/app-agent');
  const bundled_code = agentConf.entry ? await bundleCode(agentConf.entry || '') : agentConf.bundled_code;
  const sharedHosts = await firstValueFrom(shareHosts$);

  await i18n.loadNamespaces('AgentConfForm');

  const answer = await showForm<{ kernel_id: string; host_url: string }>({
    type: 'object',
    properties: {
      kernel_id: {
        title: t('AgentConfForm:input_kernel_id'),
        type: 'string',
      },
      host_url: {
        title: t('AgentConfForm:select_host'),
        type: 'string',
        examples: sharedHosts.map((host) => host.host_url),
      },
    },
  });

  const res = await supabase.from('agent').insert({
    host_url: answer.host_url,
    kernel_id: answer.kernel_id,
    version: version,
    one_json: {
      //
      ...agentConf,
      kernel_id: answer.kernel_id,
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
