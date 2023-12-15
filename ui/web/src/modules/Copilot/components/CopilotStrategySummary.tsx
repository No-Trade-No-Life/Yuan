import { IconComment, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IMessageCardProps } from '../model';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

export default ({
  payload,
  sendMessages,
  send,
}: IMessageCardProps<{
  text: string;
}>) => {
  const { t } = useTranslation('Copilot');
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>{t('Copilot:CopilotStrategySummary:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        <Button
          icon={<IconTick />}
          onClick={() => {
            send();
          }}
        >
          {t('Copilot:CopilotStrategySummary:submit')}
        </Button>,
      ]}
    >
      <Markdown rehypePlugins={[rehypeRaw]}>{payload.text}</Markdown>
    </Card>
  );
};
