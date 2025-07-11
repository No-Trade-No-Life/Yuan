import { IconDelete, IconEyeOpened, IconRefresh } from '@douyinfe/semi-icons';
import { Button, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IAgentConf } from '@yuants/agent';
import { formatTime } from '@yuants/utils';
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
import { agentConf$ } from './AgentConfForm';
import { bundleCode } from './utils';
import { DataView } from '../Interactive';

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
      <DataView
        data={data || []}
        columns={[
          { header: 'Kernel ID', accessorKey: 'kernel_id' },
          {
            header: 'Host URL',
            accessorKey: 'host_url',
            cell: (ctx) => (
              <Typography.Text copyable={{ content: ctx.getValue() }}>{ctx.getValue()}</Typography.Text>
            ),
          },
          { header: 'Version', accessorKey: 'version' },
          { header: 'Created At', accessorKey: 'created_at', cell: (ctx) => formatTime(ctx.getValue()!) },
          {
            header: 'Actions',
            cell: (ctx) => {
              return (
                <Space>
                  <Button
                    icon={<IconEyeOpened />}
                    onClick={() => {
                      agentConf$.next(ctx.row.original.one_json);
                    }}
                  >
                    {t('common:open')}
                  </Button>
                  <Button
                    type="danger"
                    icon={<IconDelete />}
                    onClick={async () => {
                      await supabase.from('agent').delete().eq('id', ctx.row.original.id);
                      refreshAction$.next();
                      Toast.success(t('common:succeed'));
                    }}
                  >
                    {t('common:delete')}
                  </Button>
                </Space>
              );
            },
          },
        ]}
      />
    </Space>
  );
});

registerCommand(
  'Agent.DeployToCloud',
  async (ctx: { agentConf: IAgentConf; host_url?: string; kernel_id?: string }) => {
    if (!ctx.agentConf) return;
    await ensureAuthenticated();
    const { version } = await resolveVersion({ name: '@yuants/app-agent' });
    const bundled_code = ctx.agentConf.entry
      ? await bundleCode(ctx.agentConf.entry || '')
      : ctx.agentConf.bundled_code;
    const sharedHosts = await firstValueFrom(shareHosts$);

    await i18n.loadNamespaces('AgentConfForm');

    const host_url =
      ctx.host_url ??
      (await showForm<string>({
        title: t('AgentConfForm:select_host'),
        type: 'string',
        examples: sharedHosts.map((host) => host.host_url),
      }));

    const kernel_id =
      ctx.kernel_id ||
      ctx.agentConf.kernel_id ||
      (await showForm<string>({
        type: 'string',
        title: t('AgentConfForm:input_kernel_id'),
      }));

    const res = await supabase.from('agent').insert({
      host_url: host_url,
      kernel_id: kernel_id,
      version: version,
      one_json: {
        //
        ...ctx.agentConf,
        kernel_id,
        is_real: true,
        bundled_code: bundled_code,
      },
    });
    if (res.error) {
      Toast.error(`${t('common:failed')}: ${res.error.code} ${res.error.message}`);
      return;
    }
    gtag('event', 'agent_deploy_complete');
    Toast.success(`${t('common:succeed')}: ${kernel_id}`);
    executeCommand('CloudAgentList');
  },
);
