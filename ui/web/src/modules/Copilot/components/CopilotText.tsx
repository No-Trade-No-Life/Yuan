import { IconComment } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IMessageCardProps } from '../model';

export default ({ payload }: IMessageCardProps<{ text: string }>) => {
  const { t } = useTranslation('Copilot');
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>{t('Copilot:CopilotText:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
    >
      {payload.text}
    </Card>
  );
};
