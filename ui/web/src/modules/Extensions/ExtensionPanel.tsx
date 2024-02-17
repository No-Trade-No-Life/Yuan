import { List, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject, from, lastValueFrom, mergeMap } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { ExtensionItem } from './ExtensionItem';
import { activeExtensions$, installExtension, loadExtension, uninstallExtension } from './utils';

const isProcessing$ = new BehaviorSubject<Record<string, boolean>>({});

registerPage('ExtensionPanel', () => {
  const { t } = useTranslation('ExtensionPanel');
  const activeExtensions = useObservableState(activeExtensions$);

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
        <Typography.Title heading={5}>
          {t('installed')} ({activeExtensions.length})
        </Typography.Title>
        <List
          style={{ width: '100%' }}
          dataSource={activeExtensions}
          renderItem={(instance) => <ExtensionItem key={instance.packageJson.name} instance={instance} />}
        ></List>
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
