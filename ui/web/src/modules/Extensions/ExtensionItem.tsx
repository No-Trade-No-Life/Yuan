import { IconArrowUp, IconDelete } from '@douyinfe/semi-icons';
import { List, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { Time } from '@icon-park/react';
import { useObservable, useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
import { defer } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { Button } from '../Interactive';
import { IActiveExtensionInstance, resolveVersion } from './utils';

export const ExtensionItem = (props: { instance: IActiveExtensionInstance }) => {
  const { t } = useTranslation('ExtensionPanel');
  const { instance } = props;

  const versionInfo = useObservableState(
    useObservable(() => defer(() => resolveVersion(instance.packageJson.name)), []),
  );

  return (
    <List.Item>
      <Space vertical align="start">
        <Typography.Title heading={6}>{instance.packageJson.name}</Typography.Title>
        <Typography.Paragraph>{instance.packageJson.description}</Typography.Paragraph>
        <Space>
          <Tag>{instance.packageJson.version}</Tag>
          <Time theme="outline" /> {instance.loadTime}ms
        </Space>
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
      </Space>
    </List.Item>
  );
};
