import { IconClose, IconCode, IconSave, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { MonacoEditor } from '../../Editor/Monaco';
import { IMessageCardProps } from '../model';

export default ({
  payload,
}: IMessageCardProps<{
  code: string;
  remark: string;
}>) => {
  return (
    <Card
      title={
        <Space>
          <IconCode /> <Typography.Text strong>Agent Code</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        //
        <Button icon={<IconTick />}>OK, test it!</Button>,
        <Button icon={<IconClose />} type="danger">
          It's not my style!
        </Button>,
        <Button icon={<IconSave />} type="secondary">
          Save to my workspace
        </Button>,
      ]}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Text>{payload.remark}</Typography.Text>
        <div style={{ width: '100%', height: 400 }}>
          <MonacoEditor
            value={payload.code}
            language="typescript"
            onConstruct={(editor) => {
              editor.updateOptions({ readOnly: true });
            }}
          />
        </div>
      </Space>
    </Card>
  );
};
