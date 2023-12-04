import { IconClose } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IMessageCardProps } from '../model';

export default ({
  payload,
}: IMessageCardProps<{
  error: string;
}>) => {
  const { t } = useTranslation('Copilot');
  return (
    <Card
      style={{ width: '100%', flexShrink: 0 }}
      title={
        <Space>
          <IconClose /> <Typography.Text strong>{t('Copilot:system_error')}</Typography.Text>
        </Space>
      }
    >
      {payload.error}
    </Card>
  );
};
