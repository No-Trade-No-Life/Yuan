import { IconFolderOpen, IconLink } from '@douyinfe/semi-icons';
import { Space, Typography } from '@douyinfe/semi-ui';
import { Book, Github, SmartOptimization } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { executeCommand } from '../CommandCenter';

export const HomePage = React.memo(() => {
  const { t } = useTranslation('HomePage');

  return (
    <Space
      vertical
      align="start"
      style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '20%',
      }}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Title>Yuan</Typography.Title>
        <Typography.Title heading={2} type="tertiary">
          {t('common:slogan')}
        </Typography.Title>
      </Space>
      <Space vertical align="start" style={{ marginTop: '3em' }}>
        <Typography.Title heading={3}>Go</Typography.Title>
        <Typography.Text
          icon={<SmartOptimization theme="outline" size="16" />}
          strong
          link={{
            onClick: () => {
              executeCommand('Copilot');
            },
          }}
        >
          Yuan Copilot
        </Typography.Text>
        {!!window['showDirectoryPicker'] && (
          <Typography.Text
            icon={<IconFolderOpen />}
            strong
            link={{
              onClick: () => {
                executeCommand('workspace.open');
              },
            }}
          >
            {t('HomePage:open_workspace')}
          </Typography.Text>
        )}

        <Typography.Text
          icon={<IconLink />}
          strong
          link={{
            onClick: () => {
              executeCommand('HostList');
            },
          }}
        >
          {t('HomePage:connect_host')}
        </Typography.Text>

        <Typography.Text
          icon={<Book theme="outline" size="16" />}
          strong
          link={{
            onClick: () => {
              executeCommand('Help');
            },
          }}
        >
          {t('HomePage:documentation')}
        </Typography.Text>
        <Typography.Text
          icon={<Github theme="outline" size="16" />}
          strong
          link={{
            onClick: () => {
              executeCommand('OpenSource');
            },
          }}
        >
          GitHub
        </Typography.Text>
      </Space>
    </Space>
  );
});
