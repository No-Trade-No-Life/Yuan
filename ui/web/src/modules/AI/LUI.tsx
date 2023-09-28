import { IconDelete, IconSend, IconUser } from '@douyinfe/semi-icons';
import { Avatar, Button, Space, TextArea } from '@douyinfe/semi-ui';
import { format } from 'date-fns';
import { TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { authState$ } from '../../common/supabase';
import { createPersistBehaviorSubject } from '../../common/utils';
import { openPage } from '../../layout-model';
import { agentConf$ } from '../Agent/AgentConfForm';
import { registerCommand } from '../CommandCenter/CommandCenter';
import { fs } from '../FileSystem/api';
import { triggerLoginModalAction$ } from '../User/Login';
import './LUI.css';

interface IMessage {
  role: 'user' | 'assistant';
  content: string;
}

const initialMessages: Array<IMessage> = [
  {
    role: 'assistant',
    content: '我是 Yuan AI 助理，可以帮助您编写专业的量化模型代码，请说明您的模型思路与规则。',
  },
];

const historyMessages$ = createPersistBehaviorSubject<IMessage[]>('history-messages', initialMessages);
const pushHistoryMessages = (...messages: IMessage[]) => {
  historyMessages$.next([...(historyMessages$.value || []), ...messages]);
};

registerCommand('AI', () => {
  openPage('LUI');
});

export const LUI = React.memo((props: { node?: TabNode }) => {
  const width = props.node?.getRect().width ?? Infinity;
  const [isLoading, setLoading] = useState(false);

  const authState = useObservableState(authState$);

  const messages = useObservableState(historyMessages$) || [];
  const [userInput, setUserInput] = useState('');
  const handleSend = async () => {
    if (!authState) {
      triggerLoginModalAction$.next();
      return;
    }

    const message = userInput.trim();
    setUserInput('');
    if (!message) return; // 过滤 EMPTY
    pushHistoryMessages({ role: 'user', content: message });
    //
    setLoading(true);
    // ISSUE: 提前申请文件系统权限
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
              content: `服务异常，请稍后再试`,
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
            `// 用户提示词:`,
            ...question.split('\n').map((x) => '// ' + x),
            `// AI备注:`,
            ...(resp.data.message.remark as string).split('\n').map((x) => '// ' + x),
            `// AIGC:`,
            resp.data.message.code,
          ].join('\n');
          await fs.writeFile(filename, code);

          pushHistoryMessages({ role: 'assistant', content: `代码已经保存到 ${filename}` });
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
              {typeof message.content === 'string' ? message.content : '[不支持查看该消息，请更新后重试]'}
            </pre>
          </div>
        ))}
      </div>
      {messages.length > 1 && (
        <Button
          icon={<IconDelete />}
          onClick={() => {
            historyMessages$.next(initialMessages);
          }}
        >
          清理聊天记录
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
          placeholder={authState ? 'Ctrl / ⌘ + ↵ 可以快捷发送' : '请登录后使用'}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleSend();
            }
          }}
        />
        {authState ? (
          <Button icon={<IconSend />} loading={isLoading} onClick={handleSend}>
            发送
          </Button>
        ) : (
          <Button icon={<IconUser />} loading={isLoading} onClick={handleSend}>
            请登录后使用
          </Button>
        )}
      </Space>
    </Space>
  );
});
