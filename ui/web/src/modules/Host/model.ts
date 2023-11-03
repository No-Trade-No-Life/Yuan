import { Subject, defer, repeat, shareReplay } from 'rxjs';
import { supabase } from '../SupaBase';
import { UUID } from '@yuants/data-model';
import { Toast } from '@douyinfe/semi-ui';
import { registerCommand } from '../CommandCenter';

const refreshAction$ = new Subject<void>();

export const shareHosts$ = defer(async () => {
  const res = await supabase.from('host').select('*');
  const data: Array<{
    id: string;
    host_token: string;
  }> = res.data || [];
  return data;
}).pipe(
  //

  repeat({ delay: () => refreshAction$ }),
  shareReplay(1),
);

registerCommand('SharedHost.New', async () => {
  const res = await supabase.from('host').insert({ host_token: UUID() }).select();
  refreshAction$.next();
});

registerCommand('SharedHost.Delete', async ({ host_id }) => {
  await supabase.from('host').delete().eq('id', host_id);
  refreshAction$.next();
});
