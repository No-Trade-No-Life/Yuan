import { IconDelete, IconSend, IconUser } from '@douyinfe/semi-icons';
import { Avatar, Button, Space, TextArea } from '@douyinfe/semi-ui';
import { format } from 'date-fns';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { agentConf$ } from '../Agent/AgentConfForm';
import { executeCommand, registerCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import { createPersistBehaviorSubject } from '../FileSystem/createPersistBehaviorSubject';
import { registerPage, usePageViewport } from '../Pages';
import { authState$ } from '../SupaBase';
import './LUI.css';

interface IMessage {
  role: 'user' | 'assistant';
  content: string;
}

const historyMessages$ = createPersistBehaviorSubject<IMessage[]>('history-messages', []);
const pushHistoryMessages = (...messages: IMessage[]) => {
  historyMessages$.next([...(historyMessages$.value || []), ...messages]);
};

registerCommand('AI.clean', () => {
  historyMessages$.next([
    {
      role: 'assistant',
      content: t('AI:hello'),
    },
  ]);
});

registerPage('AI', () => {
  const { t } = useTranslation('AI');
  const viewport = usePageViewport();
  const width = viewport?.w ?? Infinity;
  const [isLoading, setLoading] = useState(false);

  const authState = useObservableState(authState$);

  const messages = useObservableState(historyMessages$) || [];
  const [userInput, setUserInput] = useState('');

  useEffect(() => {
    if (messages.length === 0) {
      executeCommand('AI.clean');
    }
  }, []);

  const handleSend = async () => {
    if (!authState) {
      executeCommand('Login');
      return;
    }

    const message = userInput.trim();
    setUserInput('');
    if (!message) return;
    pushHistoryMessages({ role: 'user', content: message });
    //
    setLoading(true);
    // ISSUE: Request FS first
    try {
      if (!(await fs.stat('/AIGC')).isDirectory()) {
        throw Error('Not a directory');
      }
    } catch (e) {
      try {
        await fs.mkdir('/AIGC');
      } catch (e) {
        //
      }
    }

    try {
      const question = message;

      if (authState) {
        const resp = await fetch('https://api-dev.ntnl.io/assistant', {
          mode: 'cors',
          method: 'POST',
          body: JSON.stringify({ content: question }),
          credentials: 'include',
          // TODO: use cookies
          headers: {
            'yuan-refresh-token': authState.refresh_token,
            'yuan-access-token': authState.access_token,
            'Content-Type': 'application/json',
          },
        }).then(
          (x) => x.json(),
          () => {
            pushHistoryMessages({
              role: 'assistant',
              content: t('server_error'),
            });
          },
        );
        if (resp.data.messageType === 'CODE') {
          pushHistoryMessages(
            {
              role: 'assistant',
              content: resp.data.message.remark,
            },
            {
              role: 'assistant',
              content: resp.data.message.code,
            },
          );

          const filename = `/AIGC/${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.ts`;
          const code = [
            `// User Prompt`,
            ...question.split('\n').map((x) => '// ' + x),
            `// Assistant Note:`,
            ...(resp.data.message.remark as string).split('\n').map((x) => '// ' + x),
            `// AIGC Result:`,
            resp.data.message.code,
          ].join('\n');
          await fs.writeFile(filename, code);

          pushHistoryMessages({ role: 'assistant', content: `${t('common:saved')}: ${filename}` });
          agentConf$.next({ ...agentConf$.value, entry: filename });
        } else {
          pushHistoryMessages({ role: 'assistant', content: resp.data.message.content });
        }
      }
    } catch (e) {}
    setLoading(false);
  };
  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div className="MessageList">
        {messages.map((message) => (
          <div className={`MessageItem is-${message.role} ${width < 1080 ? 'is-small' : 'is-large'}`}>
            <Avatar>{message.role === 'assistant' ? 'Y' : 'U'}</Avatar>
            <pre className="MessageItem-pop">
              {typeof message.content === 'string' ? message.content : t('unsupported_message')}
            </pre>
          </div>
        ))}
      </div>
      {messages.length > 0 && (
        <Button
          icon={<IconDelete />}
          onClick={() => {
            executeCommand('AI.clean');
          }}
        >
          {t('clean')}
        </Button>
      )}
      <Space align="end" style={{ width: '100%' }}>
        <TextArea
          value={userInput}
          onChange={(v) => {
            setUserInput(v);
          }}
          autosize
          rows={1}
          style={{ flexGrow: 1 }}
          placeholder={authState ? t('input_placeholder') : t('login_first')}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleSend();
            }
          }}
        />
        {authState ? (
          <Button icon={<IconSend />} loading={isLoading} onClick={handleSend}>
            {t('send')}
          </Button>
        ) : (
          <Button icon={<IconUser />} loading={isLoading} onClick={handleSend}>
            {t('login_first')}
          </Button>
        )}
      </Space>
    </Space>
  );
});
