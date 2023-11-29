import { IconComment, IconEdit, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IMessageCardProps } from '../model';

export default ({ payload }: IMessageCardProps<{ text: string }>) => {
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>Copilot Explain</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        //
        <Button icon={<IconTick />}>OK</Button>,
        <Button icon={<IconEdit />}>Edit</Button>,
      ]}
    >
      {payload.text}
    </Card>
  );
};
