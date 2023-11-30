import { IconClear, IconSend } from '@douyinfe/semi-icons';
import { Button, Card, Empty, Space, TextArea, Typography } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { BehaviorSubject, EMPTY, Subject, catchError, defer, raceWith, tap, timeout } from 'rxjs';
import { registerPage } from '../Pages';
import { authState$ } from '../SupaBase';
import { exampleMessages } from './case';
import { IChatMessage, IMessageCardProps } from './model';

const mapMessageTypeToComponent: Record<string, React.ComponentType<IMessageCardProps<any>>> = {};

const emptyHints = [
  //
  'Show me a double moving average strategy',
  'Write a BOLL trading model',
];

export function registerCopilotMessageBlock<P extends {}>(
  type: string,
  component: React.ComponentType<IMessageCardProps<any>>,
) {
  mapMessageTypeToComponent[type] = component;
}

const API_ENDPOINT = `https://api.ntnl.io/copilot`;

registerPage('Copilot', () => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const authState = useObservableState(authState$);

  const messages$ = useMemo(
    () =>
      new BehaviorSubject<IChatMessage<any, any>[]>(
        // []
        exampleMessages,
      ),
    [],
  );
  const messages = useObservableState(messages$);

  const stop$ = useMemo(() => new Subject<void>(), []);

  const sendCurrentMessages = () => {
    defer(async () => {
      const messagesToSend = messages$.value.filter((v) => v.type !== 'SystemError');

      const res = await fetch(API_ENDPOINT, {
        mode: 'cors',
        method: 'POST',
        body: JSON.stringify({ messages: messagesToSend }),
        credentials: 'include',
        // TODO: use cookies
        headers: {
          'yuan-refresh-token': authState!.refresh_token,
          'yuan-access-token': authState!.access_token,
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();
      const newMessages: IChatMessage<any, any>[] = json.data.messages;
      messages$.next(messages$.value.concat(newMessages));
    })
      .pipe(
        tap({
          subscribe: () => {
            setLoading(true);
          },
          finalize: () => {
            setLoading(false);
          },
        }),
        raceWith(stop$),
        timeout({ first: 240_000 }),
        catchError((err) => {
          console.error(err);
          messages$.next(messages$.value.concat([{ type: 'SystemError', payload: { error: `${err}` } }]));
          return EMPTY;
        }),
      )
      .subscribe();
  };

  const handleSend = async () => {
    if (!userInput || !authState) return;
    const theUserInput = userInput;
    messages$.next(messages$.value.concat([{ type: 'UserText', payload: { text: theUserInput } }]));
    setUserInput('');
    sendCurrentMessages();
  };

  useEffect(() => {
    document.querySelector('.bottom')?.scrollIntoView();
  }, [isLoading]);

  if (!authState) {
    return <Empty>Login first to use this feature.</Empty>;
  }
  return (
    <Space vertical style={{ width: '100%', height: '100%' }}>
      <Space
        vertical
        align="start"
        style={{
          width: '100%',
          justifyContent: 'stretch',
          padding: '48px 10% 48px',
          boxSizing: 'border-box',
          overflowY: 'auto',
          flexGrow: 1,
        }}
      >
        {messages.length === 0 && (
          <Space vertical style={{ width: '100%', height: '100%', justifyContent: 'center' }}>
            <Empty image={<img src={'/yuan.svg'} width={128} height={128}></img>}></Empty>
            <Typography.Title>Yuan Copilot</Typography.Title>
            <Space align="start" style={{ width: '80%', marginTop: '2em' }}>
              <TextArea
                value={userInput}
                onChange={(v) => {
                  setUserInput(v);
                }}
                autosize
                rows={1}
                style={{ flexGrow: 1 }}
                placeholder={'Ctrl + Enter to send'}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    handleSend();
                  }
                }}
              />
              <Button disabled={!userInput} icon={<IconSend />} loading={isLoading} onClick={handleSend}>
                Send
              </Button>
            </Space>
            <Typography.Text style={{ marginTop: '2em' }}>Try asking</Typography.Text>
            <Space style={{ width: '60%', flexWrap: 'wrap' }}>
              {emptyHints.map((hint) => (
                <Typography.Text
                  size="small"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setUserInput(hint);
                  }}
                >
                  {hint}
                </Typography.Text>
              ))}
            </Space>
          </Space>
        )}
        {messages.map((msg) => {
          const component = mapMessageTypeToComponent[msg.type];
          if (!component) return null;
          return React.createElement(component, {
            payload: msg.payload,
            sendMessages: (msgList) => {
              messages$.next(messages$.value.concat(msgList));
              sendCurrentMessages();
            },
          });
        })}
        {isLoading && (
          <Card title={'Copilot: Thinking'} style={{ width: '100%', height: 200, flexShrink: 0 }} loading>
            Loading
          </Card>
        )}
        <div className="bottom"></div>
      </Space>
      {messages.length > 0 && (
        <Space
          align="end"
          style={{ width: '100%', padding: '1em 10% 1em', boxSizing: 'border-box', flex: 0 }}
        >
          <TextArea
            value={userInput}
            onChange={(v) => {
              setUserInput(v);
            }}
            autosize
            rows={1}
            style={{ flexGrow: 1 }}
            placeholder={'Ctrl + Enter to send'}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleSend();
              }
            }}
          />
          {!isLoading && (
            <Button disabled={!userInput} icon={<IconSend />} loading={isLoading} onClick={handleSend}>
              Send
            </Button>
          )}

          {isLoading && (
            <Button
              icon={<IconClear />}
              type="danger"
              onClick={() => {
                stop$.next();
              }}
            >
              Stop
            </Button>
          )}
          {!isLoading && messages.length > 0 && (
            <Button
              icon={<IconClear />}
              type="danger"
              onClick={() => {
                messages$.next([]);
              }}
            >
              Clear
            </Button>
          )}
        </Space>
      )}
    </Space>
  );
});
