import { IconFastForward, IconHelpCircle, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import Form from '../../Form';
import { IMessageCardProps } from '../model';

export default ({
  sendMessages,
  payload,
}: IMessageCardProps<{
  id: string;
  schema: JSONSchema7;
}>) => {
  const [formData, setFormData] = useState(undefined);
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
        <Button
          icon={<IconTick />}
          disabled={!formData}
          onClick={() => {
            sendMessages([{ type: 'UserFormInput', payload: { id: payload.id, answer: formData } }]);
          }}
        >
          Submit
        </Button>,
        <Button
          icon={<IconFastForward />}
          onClick={() => {
            sendMessages([{ type: 'UserFormInput', payload: { id: payload.id, answer: undefined } }]);
          }}
        >
          Not sure. Skip
        </Button>,
      ]}
    >
      <Form
        schema={payload.schema}
        formData={formData}
        onChange={(e) => {
          setFormData(e.formData);
        }}
      >
        <div></div>
      </Form>
    </Card>
  );
};
