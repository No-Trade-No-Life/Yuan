import { IconClose } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IMessageCardProps } from '../model';

export default ({
  payload,
}: IMessageCardProps<{
  error: string;
}>) => {
  return (
    <Card
      style={{ width: '100%', flexShrink: 0 }}
      title={
        <Space>
          <IconClose /> <Typography.Text strong>System Error</Typography.Text>
        </Space>
      }
    >
      {payload.error}
    </Card>
  );
};
