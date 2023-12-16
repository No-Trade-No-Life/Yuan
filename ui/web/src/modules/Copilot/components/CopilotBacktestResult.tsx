import { IconComment, IconTick } from '@douyinfe/semi-icons';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { IMessageCardProps } from '../model';

export default ({
  payload,
  replaceMessage,
  send,
}: IMessageCardProps<{
  suggestions: string[];
  summary: string;
}>) => {
  const { t } = useTranslation('Copilot');
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>{t('Copilot:CopilotText:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        <Button icon={<IconTick />} onClick={() => {}}>
          {t('Copilot:SystemBacktestResult:deploy')}
        </Button>,
        <Button icon={<IconTick />} onClick={() => {}}>
          {t('Copilot:SystemBacktestResult:retest')}
        </Button>,
      ]}
    >
      <Markdown rehypePlugins={[rehypeRaw]}>{payload.summary}</Markdown>
      {payload.suggestions.length > 0 && (
        <>
          <Typography.Text strong>{t('Copilot:SystemBacktestResult:suggestion')}</Typography.Text>
          {payload.suggestions.map((suggestion) => {
            return (
              <div>
                <Button
                  theme="light"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    replaceMessage([{ type: 'OptimizeModel', payload: { text: suggestion } }]);
                    send();
                  }}
                >
                  {suggestion}
                </Button>
              </div>
            );
          })}
        </>
      )}
    </Card>
  );
};
