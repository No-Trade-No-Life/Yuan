import { Button, Space, Table } from '@douyinfe/semi-ui';
import { registerPage } from '../Pages';
import { supabase } from '../SupaBase';
import { Subject, defer, repeat, shareReplay } from 'rxjs';
import { useObservableState } from 'observable-hooks';
import { IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import { t } from 'i18next';
import { executeCommand, registerCommand } from '../CommandCenter';

const refreshAction$ = new Subject<void>();

const shareManifests$ = defer(async () => {
  const res = await supabase.from('manifest').select('*');
  const data: Array<{
    id: string;
    content: {};
    deploy_key: string;
    host_id: string;
  }> = res.data || [];
  return data;
}).pipe(
  //

  repeat({ delay: () => refreshAction$ }),
  shareReplay(1),
);

registerCommand('Manifest.Delete', async ({ id }) => {
  await supabase.from('manifest').delete().eq('id', id);
  refreshAction$.next();
});

registerPage('ManifestList', () => {
  const data = useObservableState(shareManifests$);

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
            title: 'Deploy Key',
            render: (_, v) => v.deploy_key,
          },
          {
            title: 'Actions',
            render: (_, v) => (
              <Space>
                <Button
                  type="danger"
                  icon={<IconDelete />}
                  onClick={() => {
                    executeCommand('Manifest.Delete', { id: v.id });
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
