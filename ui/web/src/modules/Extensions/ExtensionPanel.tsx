import { IconArrowUp, IconDelete } from '@douyinfe/semi-icons';
import { Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { t } from 'i18next';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject, defer, from, lastValueFrom, mergeMap } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import {
  IActiveExtensionInstance,
  activeExtensions$,
  installExtension,
  loadExtension,
  resolveVersion,
  uninstallExtension,
} from './utils';

const isProcessing$ = new BehaviorSubject<Record<string, boolean>>({});

registerPage('ExtensionPanel', () => {
  const { t } = useTranslation('ExtensionPanel');
  const activeExtensions = useObservableState(activeExtensions$);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<IActiveExtensionInstance>();
    return [
      columnHelper.accessor('packageJson.name', { header: () => 'Name' }),
      columnHelper.accessor('packageJson.version', { header: () => 'Version' }),
      columnHelper.accessor('loadTime', { header: () => 'Load Time', cell: (ctx) => `${ctx.getValue()}ms` }),
      columnHelper.display({
        id: 'actions',
        header: () => 'Actions',
        cell: (ctx) => {
          const instance = ctx.row.original;
          const versionInfo = useObservableState(
            useObservable(() => defer(() => resolveVersion(instance.packageJson.name)), []),
          );

          return (
            <Space>
              {versionInfo?.version && versionInfo.version !== instance.packageJson.version && (
                <Button
                  icon={<IconArrowUp />}
                  onClick={() => executeCommand('Extension.install', { name: instance.packageJson.name })}
                >
                  {t('upgrade')} ({versionInfo.version})
                </Button>
              )}
              <Button
                icon={<IconDelete />}
                onClick={() => executeCommand('Extension.uninstall', { name: instance.packageJson.name })}
              >
                {t('uninstall')}
              </Button>
            </Space>
          );
        },
      }),
    ];
  }, []);

  const table = useReactTable({ columns, data: activeExtensions, getCoreRowModel: getCoreRowModel() });

  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Space>
        <Button onClick={() => executeCommand('Extension.install')}>{t('install_new_button')}</Button>
        <Button
          onClick={() =>
            lastValueFrom(
              from(activeExtensions).pipe(
                mergeMap((extension) =>
                  executeCommand('Extension.install', { name: extension.packageJson.name }),
                ),
              ),
            )
          }
        >
          {t('install_all')}
        </Button>
      </Space>
      <div style={{ width: '100%', overflow: 'auto' }}>
        <DataView table={table} />
      </div>
    </Space>
  );
});

registerCommand('Extension.install', async (params) => {
  const name =
    params.name || (await showForm<string>({ type: 'string', title: t('ExtensionPanel:install_prompt') }));
  if (!name) return;
  isProcessing$.next({ ...isProcessing$.value, [name]: true });
  try {
    await installExtension(name);
    await loadExtension(name);
    Toast.success(`${t('ExtensionPanel:install_succeed')}: ${name}`);
  } catch (e) {
    Toast.error(`${t('ExtensionPanel:install failed')}: ${name}: ${e}`);
  }
  isProcessing$.next({ ...isProcessing$.value, [name]: false });
});

registerCommand('Extension.uninstall', async (params) => {
  const name = params.name;
  if (!name) return;
  isProcessing$.next({ ...isProcessing$.value, [name]: true });
  try {
    await uninstallExtension(name);
    Toast.success(`${t('ExtensionPanel:uninstall_succeed')}: ${name}`);
  } catch (e) {
    Toast.success(`${t('ExtensionPanel:uninstall_failed')}: ${name}: ${e}`);
  }
  isProcessing$.next({ ...isProcessing$.value, [name]: false });
});
