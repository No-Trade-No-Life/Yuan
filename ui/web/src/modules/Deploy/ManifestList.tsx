import { IconDelete, IconRefresh, IconUndo } from '@douyinfe/semi-icons';
import { Space, Table } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { IDeploySpec } from '@yuants/extension';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { BehaviorSubject, Subject, defer, repeat, shareReplay } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { supabase } from '../SupaBase';
import { useEffect } from 'react';

export interface ISupabaseManifestRecord {
  id: string;
  user_id: string;
  manifest: IDeploySpec;
  created_at: string;
  updated_at: string;
  expired_at: string | null;
}

const ManifestList$ = new BehaviorSubject<ISupabaseManifestRecord[]>([]);

registerCommand('Manifest.Load', async () => {
  const res = await supabase.from('manifest').select('*');
  const data: Array<ISupabaseManifestRecord> = res.data || [];
  ManifestList$.next(data);
});

registerCommand('Manifest.Delete', async ({ id }) => {
  await supabase
    .from('manifest')
    .update({ expired_at: formatTime(Date.now()) })
    .eq('id', id);
  await executeCommand('Manifest.Load');
});

registerCommand('Manifest.Recover', async ({ id }) => {
  await supabase.from('manifest').update({ expired_at: null }).eq('id', id);
  await executeCommand('Manifest.Load');
});

registerPage('ManifestList', () => {
  const data = useObservableState(ManifestList$);

  useEffect(() => {
    executeCommand('Manifest.Load');
  }, []);

  return (
    <Space vertical align="start">
      <Space>
        <Button icon={<IconRefresh />} onClick={() => executeCommand('Manifest.Load')}></Button>
      </Space>
      <Table
        dataSource={data}
        columns={[
          //
          {
            title: 'ID',
            render: (_, v) => v.id,
          },
          {
            title: 'Package',
            render: (_, v) => v.manifest.package,
          },
          {
            title: 'Version',
            render: (_, v) => v.manifest.version,
          },
          {
            title: 'Updated At',
            render: (_, v) => formatTime(v.updated_at),
          },
          {
            title: 'Created At',
            render: (_, v) => formatTime(v.created_at),
          },
          {
            title: 'Expired At',
            render: (_, v) => (v.expired_at ? formatTime(v.expired_at) : '-'),
          },
          {
            title: 'Manifest',
            width: 300,
            render: (_, v) => JSON.stringify(v.manifest),
          },
          {
            title: 'Actions',
            render: (_, v) => (
              <Space>
                {/* <Button icon={<IconEdit />} onClick={() => executeCommand('Manifest.Edit', { id: v.id })}>
                  {t('common:edit')}
                </Button> */}
                {v.expired_at && (
                  <Button
                    icon={<IconUndo />}
                    onClick={() => executeCommand('Manifest.Recover', { id: v.id })}
                  >
                    {t('common:recover')}
                  </Button>
                )}
                {!v.expired_at && (
                  <Button
                    type="danger"
                    icon={<IconDelete />}
                    onClick={() => executeCommand('Manifest.Delete', { id: v.id })}
                  >
                    {t('common:delete')}
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      ></Table>
    </Space>
  );
});
