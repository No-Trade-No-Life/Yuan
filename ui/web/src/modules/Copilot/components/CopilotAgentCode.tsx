import { IconCode, IconSave, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { bundleCodeFromInMemoryCode } from '../../Agent/utils';
import { MonacoEditor } from '../../Editor/Monaco';
import { LocalAgentScene } from '../../StaticFileServerStorage/LocalAgentScene';
import { IMessageCardProps } from '../model';

export default ({
  sendMessages,
  appendMessages,
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
        <Button
          icon={<IconTick />}
          onClick={async () => {
            try {
              const bundled_code = await bundleCodeFromInMemoryCode(payload.code);
              const scene = await LocalAgentScene({ bundled_code });
              const schema = scene.agentUnit.paramsSchema;

              appendMessages([{ type: 'AgentConfigForm', payload: { bundled_code, schema } }]);
            } catch (e) {
              Toast.error(`Compile Error: ${e}`);
              sendMessages([{ type: 'UserText', payload: { text: `${e}` } }]);
            }
          }}
        >
          OK, test it!
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
