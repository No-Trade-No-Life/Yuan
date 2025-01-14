import { IconDelete, IconRefresh, IconUndo } from '@douyinfe/semi-icons';
import { Space } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatTime } from '@yuants/data-model';
import { IDeploySpec } from '@yuants/extension';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { useEffect, useMemo } from 'react';
import { BehaviorSubject } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { supabase } from '../SupaBase';

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

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<ISupabaseManifestRecord>();
    return [
      columnHelper.accessor('id', {
        header: () => 'ID',
      }),
      columnHelper.accessor('manifest.package', {
        header: () => 'Package',
      }),
      columnHelper.accessor('manifest.version', {
        header: () => 'Version',
      }),
      columnHelper.accessor('updated_at', {
        header: () => 'Updated At',
        cell: (x) => formatTime(x.getValue()),
      }),
      columnHelper.accessor('created_at', {
        header: () => 'Created At',
        cell: (x) => formatTime(x.getValue()),
      }),
      columnHelper.accessor('expired_at', {
        header: () => 'Expired At',
        cell: (x) => {
          const t = x.getValue();
          return t ? formatTime(t) : '-';
        },
      }),
      columnHelper.accessor('manifest', {
        header: () => 'Manifest',
        cell: (x) => <div style={{ width: 300 }}>{JSON.stringify(x.getValue())}</div>,
      }),
      columnHelper.display({
        id: 'actions',
        header: () => 'Actions',
        cell: (x) => {
          const v = x.row.original;
          return (
            <Space>
              {/* <Button icon={<IconEdit />} onClick={() => executeCommand('Manifest.Edit', { id: v.id })}>
            {t('common:edit')}
          </Button> */}
              {v.expired_at && (
                <Button icon={<IconUndo />} onClick={() => executeCommand('Manifest.Recover', { id: v.id })}>
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
          );
        },
      }),
    ];
  }, []);

  return (
    <Space vertical align="start">
      <Space>
        <Button icon={<IconRefresh />} onClick={() => executeCommand('Manifest.Load')}></Button>
      </Space>
      <DataView columns={columns} data={data} />
    </Space>
  );
});
