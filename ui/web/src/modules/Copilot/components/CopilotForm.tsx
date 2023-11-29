import { IconHelpCircle, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { JSONSchema7 } from 'json-schema';
import Form from '../../Form';
import { IMessageCardProps } from '../model';

export default ({
  payload,
}: IMessageCardProps<{
  id: string;
  schema: JSONSchema7;
}>) => {
  return (
    <Card
      style={{ width: '100%', flexShrink: 0 }}
      title={
        <Space>
          <IconHelpCircle /> <Typography.Text strong>Require more context</Typography.Text>
        </Space>
      }
      actions={[
        //
        <Button icon={<IconTick />}>Submit</Button>,
      ]}
    >
      <Form schema={payload.schema}>
        <div></div>
      </Form>
    </Card>
  );
};
