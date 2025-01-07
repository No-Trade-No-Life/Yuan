import { IconArrowUp, IconDelete } from '@douyinfe/semi-icons';
import { Space } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defer, from, lastValueFrom, mergeMap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { registerAssociationRule } from '../Workspace';
import {
  IActiveExtensionInstance,
  activeExtensions$,
  installExtensionFromTgz,
  resolveVersion,
} from './utils';

registerAssociationRule({
  id: 'Extension',
  match: ({ path, isFile }) => isFile && !!path.match(/\.tgz$/),
  action: ({ path }) => {
    installExtensionFromTgz(path);
  },
});

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
                  onClick={() =>
                    executeCommand('Extension.install', {
                      name: instance.packageJson.name,
                      immediateSubmit: true,
                    })
                  }
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
                  executeCommand('Extension.install', {
                    name: extension.packageJson.name,
                    immediateSubmit: true,
                  }),
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
