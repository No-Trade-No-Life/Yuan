import { Chat, Divider, List, Space, Typography } from '@douyinfe/semi-ui';
import { Message } from '@douyinfe/semi-ui/lib/es/chat/interface';
import { IResponse } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { filter, from, map, mergeMap, tap, toArray } from 'rxjs';
import { registerPage } from '../Pages';
import { terminal$, useTerminal } from '../Terminals';

declare module '@yuants/protocol' {
  interface IService {
    ChatWithAI: {
      req: {
        model: string;
        messages: any[];
      };
      frame: {
        content: string;
      };
      res: IResponse<{
        content: string;
      }>;
    };
  }
}

registerPage('Chat', () => {
  const terminal = useTerminal();
  const initialChats = (): Message[] => [];
  const [chats, setChats] = useState<Message[]>(initialChats());

  const models = useObservableState(
    useObservable(() =>
      terminal$.pipe(
        filter((terminal) => !!terminal),
        mergeMap((terminal) =>
          from(terminal.terminalInfos$).pipe(
            mergeMap((x) =>
              from(x).pipe(
                mergeMap((x) => from(Object.values(x.serviceInfo || {}))),
                filter((x) => x.method === 'ChatWithAI'),
                map((x) => x.schema),
                mergeMap((schema) => {
                  if (typeof schema.properties?.model === 'object') {
                    if (typeof schema.properties.model.const === 'string') {
                      return [schema.properties.model.const];
                    }
                    if (schema.properties.model.enum) {
                      return schema.properties.model.enum.filter((x: any) => typeof x === 'string');
                    }
                  }
                  return [];
                }),
                toArray(),
              ),
            ),
          ),
        ),
      ),
    ),
    [],
  );

  const [model, setModel] = useState('PM');

  return (
    <Space align="start" style={{ width: '100%', height: '100%' }}>
      <List
        dataSource={models}
        renderItem={(item) => (
          <List.Item
            header={item}
            onClick={() => {
              setModel(item);
            }}
          ></List.Item>
        )}
      ></List>
      <Divider layout="vertical" />
      <Space vertical align="start" style={{ width: '100%', height: '100%' }}>
        <Typography.Title>{model}</Typography.Title>
        <Chat
          chats={chats}
          style={{ width: '100%', height: '100%' }}
          //   roleConfig={{
          //     user: {
          //       name: 'User',
          //       avatar:
          //         'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
          //     },
          //     assistant: {
          //       name: 'Assistant',
          //       avatar:
          //         'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
          //     },
          //     system: {
          //       name: 'System',
          //       avatar:
          //         'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
          //     },
          //   }}
          showStopGenerate
          showClearContext
          onChatsChange={(chats) => {
            console.info('chats', chats);
            setChats(chats || initialChats());
          }}
          onMessageSend={(content) => {
            const messages: Message[] = chats
              .slice(chats.findLastIndex((x) => x.role === 'divider') + 1)
              .concat([{ role: 'user', content }]);
            if (!terminal) return;

            let message = '';
            let status: Message['status'] = 'loading';
            from(terminal.requestService('ChatWithAI', { model, messages }))
              .pipe(
                tap((msg) => {
                  if (msg.frame) {
                    message += msg.frame.content;
                    status = 'incomplete';
                  } else if (msg.res) {
                    if (msg.res.data) {
                      message = msg.res.data?.content;
                      status = 'complete';
                    }
                  }
                  setChats([...messages, { role: 'assistant', content: message, status }]);
                }),
              )
              .subscribe({
                error: (err) => {
                  //
                  setChats([...messages, { role: 'system', content: `${err}` }]);
                },
              });
          }}
        />
      </Space>
    </Space>
  );
});
