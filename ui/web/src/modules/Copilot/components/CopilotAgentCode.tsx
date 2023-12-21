import { IconClose, IconCode, IconSave, IconTick } from '@douyinfe/semi-icons';
import { Card, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { Button } from '../../Interactive';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { bundleCodeFromInMemoryCode } from '../../Agent/utils';
import { executeCommand } from '../../CommandCenter';
import { MonacoEditor } from '../../Editor/Monaco';
import { fs } from '../../FileSystem/api';
import { LocalAgentScene } from '../../StaticFileServerStorage/LocalAgentScene';
import { IMessageCardProps } from '../model';
export default ({
  replaceMessage,
  send,
  payload,
}: IMessageCardProps<{
  code: string;
  remark: string;
}>) => {
  const { t } = useTranslation();
  return (
    <Card
      title={
        <Space>
          <IconCode /> <Typography.Text strong>{t('Copilot:CopilotAgentCode:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        //
        <Button
          icon={<IconTick />}
          onClick={async () => {
            try {
              await executeCommand('workspace.import_examples');
              const bundled_code = await bundleCodeFromInMemoryCode(payload.code);
              const scene = await LocalAgentScene({ bundled_code });
              const schema = scene.agentUnit.paramsSchema;

              replaceMessage([{ type: 'AgentConfigForm', payload: { bundled_code, schema } }]);
              gtag('event', 'copilot_agent_code_complete');
            } catch (e) {
              Toast.error(`Compile Error: ${e}`);
              replaceMessage([{ type: 'UserText', payload: { text: `${e}` } }]);
              send();
              gtag('event', 'copilot_agent_code_error', { message: `${e}` });
            }
          }}
        >
          {t('Copilot:CopilotAgentCode:code_complete')}
        </Button>,
        <Button
          icon={<IconClose />}
          onClick={async () => {
            replaceMessage([]);
          }}
        >
          {t('Copilot:CopilotAgentCode:code_report_error')}
        </Button>,
        <Button
          icon={<IconSave />}
          type="secondary"
          onClick={async () => {
            const filename = `/AIGC/${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.ts`;
            await fs.ensureDir('/AIGC');
            await fs.writeFile(filename, payload.code);
            Toast.success(`${t('common:saved')}: ${filename}`);
            gtag('event', 'copilot_agent_code_saved');
          }}
        >
          {t('Copilot:CopilotAgentCode:save_code')}
        </Button>,
      ]}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Markdown rehypePlugins={[rehypeRaw]}>{payload.remark}</Markdown>
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
