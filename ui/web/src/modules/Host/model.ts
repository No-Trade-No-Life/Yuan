import { Toast } from '@douyinfe/semi-ui';
import { UUID } from '@yuants/data-model';
import { t } from 'i18next';
import { Subject, defer, repeat, shareReplay } from 'rxjs';
import { registerCommand } from '../CommandCenter';
import { supabase } from '../SupaBase';

const refreshAction$ = new Subject<void>();

export interface ISharedHost {
  host_url: string;
  id: string;
  name: string;
  host_token: string;
}

export const shareHosts$ = defer(async () => {
  const res = await supabase.from('host').select('*');
  const data: Array<{
    id: string;
    name: string;
    host_token: string;
  }> = res.data || [];
  return data.map((item) => ({
    ...item,
    host_url: `wss://api.ntnl.io/hosts?host_id=${item.id}&host_token=${item.host_token}`,
  }));
}).pipe(
  //
  repeat({ delay: () => refreshAction$ }),
  shareReplay(1),
);

registerCommand('SharedHost.New', async () => {
  const res = await supabase.from('host').insert({ host_token: UUID() }).select();
  refreshAction$.next();
  if (res.error) {
    Toast.error(`${t('common:failed')}: ${res.error.code}, ${res.error.message}`);
    console.error(res.error);
    return;
  }
  Toast.success(t('common:succeed'));
});

registerCommand('SharedHost.Delete', async ({ host_id }) => {
  await supabase.from('host').delete().eq('id', host_id);
  refreshAction$.next();
});
