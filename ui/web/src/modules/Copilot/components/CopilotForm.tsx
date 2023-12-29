import { IconFastForward, IconHelpCircle, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from '../../Form';
import { IMessageCardProps } from '../model';

export default ({
  replaceMessage,
  send,
  payload,
}: IMessageCardProps<{
  id: string;
  schema: JSONSchema7;
}>) => {
  const { t } = useTranslation('Copilot');
  const [formData, setFormData] = useState(undefined);
  return (
    <Card
      style={{ width: '100%', flexShrink: 0 }}
      title={
        <Space>
          <IconHelpCircle /> <Typography.Text strong>{t('Copilot:CopilotForm:title')}</Typography.Text>
        </Space>
      }
      actions={[
        //
        <Button
          icon={<IconTick />}
          disabled={!formData}
          onClick={() => {
            gtag('event', 'copilot_copilot_form_submit');
            replaceMessage([{ type: 'UserFormInput', payload: { id: payload.id, answer: formData } }]);
            send();
          }}
        >
          {t('Copilot:CopilotForm:submit')}
        </Button>,
        <Button
          icon={<IconFastForward />}
          onClick={() => {
            gtag('event', 'copilot_copilot_form_skip');
            replaceMessage([{ type: 'UserFormInput', payload: { id: payload.id, answer: undefined } }]);
            send();
          }}
        >
          {t('Copilot:CopilotForm:skip')}
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
