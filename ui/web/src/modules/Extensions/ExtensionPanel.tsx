import { IconArrowUp } from '@douyinfe/semi-icons';
import { Button, List, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Time } from '@icon-park/react';
import { useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerPage } from '../Pages';
import { activeExtensions$, installExtension, loadExtension } from './utils';

registerPage('ExtensionPanel', () => {
  const { t } = useTranslation('ExtensionPanel');
  const activeExtensions = useObservableState(activeExtensions$);

  const [isProcessing, setProgressing] = useState(false);

  async function handleInstallExtension(name: string) {
    setProgressing(true);
    try {
      await installExtension(name);
      await loadExtension(name);
      Toast.success(`${t('install_succeed')}: ${name}`);
    } catch (e) {
      Toast.error(`${t('install failed')}: ${name}: ${e}`);
    }
    setProgressing(false);
  }

  const handleInstall = async () => {
    const name = prompt(t('install_prompt'));
    if (!name) return;
    await handleInstallExtension(name);
  };

  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Space>
        <Button loading={isProcessing} onClick={handleInstall}>
          {t('install_new_button')}
        </Button>
      </Space>
      <div style={{ width: '100%', overflow: 'auto' }}>
        <Typography.Title heading={5}>
          {t('installed')} ({activeExtensions.length})
        </Typography.Title>
        <List
          style={{ width: '100%' }}
          dataSource={activeExtensions}
          renderItem={(instance) => (
            <List.Item>
              <Space vertical align="start">
                <Typography.Title heading={6}>{instance.packageJson.name}</Typography.Title>
                <Typography.Paragraph>{instance.packageJson.description}</Typography.Paragraph>
                <Space>
                  <Tag>{instance.packageJson.version}</Tag>
                  <Time theme="outline" /> {instance.loadTime}ms
                </Space>
                <Button
                  loading={isProcessing}
                  icon={<IconArrowUp />}
                  onClick={() => handleInstallExtension(instance.packageJson.name)}
                >
                  {t('upgrade')}
                </Button>
              </Space>
              {/* <pre>{JSON.stringify(instance.packageJson, null, 2)}</pre> */}
            </List.Item>
          )}
        ></List>
      </div>
    </Space>
  );
});
