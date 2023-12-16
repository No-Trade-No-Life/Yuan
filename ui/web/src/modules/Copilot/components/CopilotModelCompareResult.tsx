import { IconComment } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { IMessageCardProps } from '../model';

export default ({
  payload,
  send,
}: IMessageCardProps<{
  description: string;
  best_mode_id: number;
}>) => {
  const { t } = useTranslation('Copilot');
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>{t('Copilot:CopilotModelCompareResult:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[]}
    >
      <Markdown rehypePlugins={[rehypeRaw]}>{payload.description}</Markdown>
    </Card>
  );
};
