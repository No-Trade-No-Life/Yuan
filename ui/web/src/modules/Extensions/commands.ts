import { t } from 'i18next';
import { registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { Toast } from '../Interactive';
import { INpmPackagePullParams, installExtension, loadExtension, uninstallExtension } from './utils';

registerCommand('Extension.install', async (params: { name?: string; immediateSubmit?: boolean }) => {
  const initialData: Partial<INpmPackagePullParams> = {
    name: params.name,
  };
  const data = await showForm<INpmPackagePullParams>(
    {
      type: 'object',
      required: ['name', 'registry'],
      properties: {
        name: {
          type: 'string',
          title: '拓展名',
          description: 'NPM 包名，格式为 @scope/package-name 或者 package-name',
        },
        version: { type: 'string', title: '版本', description: '留空则安装最新版本' },
        registry: {
          type: 'string',
          title: 'NPM 源',
          description: 'NPM 源地址',
          examples: [
            'https://registry.npmjs.org', // NPM 官方源
            'https://registry.npmmirror.com', // NPM 镜像源
            'https://registry.yarnpkg.com', // Yarn 源
            'https://npm.pkg.github.com', // GitHub NPM 源
          ],
        },
        npm_token: {
          type: 'string',
          title: 'NPM Token',
          description: '用于访问私有 NPM 包，公开 NPM 包可以留空',
        },
      },
    },
    initialData,
    {
      immediateSubmit: params.immediateSubmit,
    },
  );
  const { name } = data;
  try {
    await installExtension(data);
    await loadExtension(name);
    Toast.success(`${t('ExtensionPanel:install_succeed')}: ${name}`);
  } catch (e) {
    Toast.error(`${t('ExtensionPanel:install failed')}: ${name}: ${e}`);
  }
});

registerCommand('Extension.uninstall', async (params) => {
  const name = params.name;
  if (!name) return;
  try {
    await uninstallExtension(name);
    Toast.success(`${t('ExtensionPanel:uninstall_succeed')}: ${name}`);
  } catch (e) {
    Toast.success(`${t('ExtensionPanel:uninstall_failed')}: ${name}: ${e}`);
  }
});
