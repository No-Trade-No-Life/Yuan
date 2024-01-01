import { IconCode, IconComment } from '@douyinfe/semi-icons';
import { Button, Card, List, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IMessageCardProps } from '../model';
import { useMemo } from 'react';
import ModelCard from './CopilotButton';
import { fs } from '../../FileSystem/api';
import { executeCommand } from '../../CommandCenter';
export default ({ replaceMessage }: IMessageCardProps<{}>) => {
  const { t } = useTranslation('Copilot');

  const codeExamples = useMemo(
    (): Array<{ icon?: React.ReactNode; title?: string; code: string; description: string }> => [
      //
      {
        code: t('Copilot:CopilotDefaultModels:example1:code'),
        title: t('Copilot:CopilotDefaultModels:example1:title'),
        description: t('Copilot:CopilotDefaultModels:example1:description'),
      },
      {
        code: t('Copilot:CopilotDefaultModels:example2:code'),
        title: t('Copilot:CopilotDefaultModels:example2:title'),
        description: t('Copilot:CopilotDefaultModels:example2:description'),
      },
      {
        code: t('Copilot:CopilotDefaultModels:example3:code'),
        title: t('Copilot:CopilotDefaultModels:example3:title'),
        description: t('Copilot:CopilotDefaultModels:example3:description'),
      },
    ],
    [t],
  );

  const clickModel = async (code: string, remark: string) => {
    gtag('event', 'copilot_rcmd_model_click');
    if (!(await fs.exists(code))) {
      await executeCommand('workspace.import_examples');
    }
    const realCode = await fs.readFile(code);
    replaceMessage([
      {
        type: 'CopilotAgentCode',
        payload: {
          code: realCode,
          remark: remark,
        },
      },
    ]);
  };

  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>{t('Copilot:CopilotText:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        <Button
          icon={<IconCode />}
          onClick={() => {
            gtag('event', 'copilot_custom_model_click');
            replaceMessage([
              {
                type: 'CopilotAgentCode',
                payload: {
                  code: t('Copilot:CopilotDefaultModels:code_remark'),
                  remark: '',
                  readonly: false,
                },
              },
            ]);
          }}
        >
          {t('Copilot:CopilotDefaultModels:submit')}
        </Button>,
      ]}
    >
      <Typography.Text strong style={{ fontSize: '1.5em' }}>
        {t('Copilot:CopilotDefaultModels:found')}
      </Typography.Text>
      <List
        grid={{
          gutter: 12,
        }}
        style={{ marginTop: 24, marginBottom: 24 }}
        dataSource={codeExamples}
        renderItem={(item) => (
          <ModelCard
            children={
              <div style={{ padding: 8 }}>
                <Space vertical align="start">
                  <Typography.Text style={{ fontSize: '1.5em' }} type="primary">
                    {item.title}
                  </Typography.Text>
                  <div>
                    <Typography.Text type="tertiary">{item.description}</Typography.Text>
                  </div>
                </Space>
              </div>
            }
            style={{
              height: '120px',
              width: '260px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              marginBottom: 12,
              marginRight: 12,
            }}
            onClick={() => clickModel(item.code, item.description)}
          />
        )}
      />
    </Card>
  );
};
