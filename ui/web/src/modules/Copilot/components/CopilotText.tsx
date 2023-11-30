import { IconComment } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IMessageCardProps } from '../model';

export default ({ payload }: IMessageCardProps<{ text: string }>) => {
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>Copilot</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
    >
      {payload.text}
    </Card>
  );
};
