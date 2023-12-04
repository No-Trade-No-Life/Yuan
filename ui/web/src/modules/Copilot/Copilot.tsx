import { IconClear, IconFolderOpen, IconLink, IconSend } from '@douyinfe/semi-icons';
import { Button, Card, Empty, Space, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { Book, Github } from '@icon-park/react';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject, EMPTY, Subject, catchError, defer, raceWith, tap, timeout } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { region$ } from '../Locale/utils';
import { registerPage } from '../Pages';
import { authState$ } from '../SupaBase';
import { IChatMessage, IMessageCardProps } from './model';

const mapMessageTypeToComponent: Record<string, React.ComponentType<IMessageCardProps<any>>> = {};

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
  const { t } = useTranslation('Copilot');

  const examples = useMemo(
    () => [
      //
      t('Copilot:prompt_example_1'),
      t('Copilot:prompt_example_2'),
      t('Copilot:prompt_example_3'),
      t('Copilot:prompt_example_4'),
    ],
    [t],
  );

  const messages$ = useMemo(
    () =>
      new BehaviorSubject<IChatMessage<any, any>[]>(
        [],
        // exampleMessages,
      ),
    [],
  );
  const messages = useObservableState(messages$);

  const stop$ = useMemo(() => new Subject<void>(), []);

  const region = useObservableState(region$);

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
    if (!userInput) return;
    gtag('event', 'copilot_push_message');
    if (!authState) {
      gtag('event', 'copilot_push_message_401');
      Toast.info(t('common:need_login'));
      executeCommand('Login');
      return;
    }
    gtag('event', 'copilot_push_message_200');
    const theUserInput = userInput;
    messages$.next(messages$.value.concat([{ type: 'UserText', payload: { text: theUserInput } }]));
    setUserInput('');
    sendCurrentMessages();
  };

  useEffect(() => {
    document.querySelector('.bottom')?.scrollIntoView();
  }, [messages]);

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
            <Typography.Title heading={2} type="tertiary">
              {t('Copilot:slogan')}
            </Typography.Title>
            <Space align="start" style={{ width: '80%', marginTop: '2em' }}>
              <TextArea
                value={userInput}
                onChange={(v) => {
                  setUserInput(v);
                }}
                autosize
                rows={1}
                style={{ flexGrow: 1 }}
                placeholder={t('Copilot:input_placeholder')}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    handleSend();
                  }
                }}
              />
              <Button disabled={!userInput} icon={<IconSend />} loading={isLoading} onClick={handleSend}>
                {t('Copilot:send')}
              </Button>
            </Space>
            <Typography.Text style={{ marginTop: '2em' }}>{t('Copilot:try_asking')}</Typography.Text>
            <Space style={{ flexWrap: 'wrap' }}>
              {examples.map((hint) => (
                <Typography.Text
                  size="small"
                  style={{ cursor: 'pointer' }}
                  link={{}}
                  onClick={() => {
                    setUserInput(hint);
                  }}
                >
                  {hint}
                </Typography.Text>
              ))}
            </Space>

            <Typography.Text style={{ marginTop: '2em' }}>{t('Copilot:extra_action')}</Typography.Text>
            <Space style={{ flexWrap: 'wrap' }}>
              {!!window['showDirectoryPicker'] && (
                <Typography.Text
                  icon={<IconFolderOpen />}
                  strong
                  link={{
                    onClick: () => {
                      executeCommand('workspace.open');
                    },
                  }}
                >
                  {t('Copilot:open_workspace')}
                </Typography.Text>
              )}

              <Typography.Text
                icon={<IconLink />}
                strong
                link={{
                  onClick: () => {
                    executeCommand('HostList');
                  },
                }}
              >
                {t('Copilot:connect_host')}
              </Typography.Text>

              <Typography.Text
                icon={<Book theme="outline" size="16" />}
                strong
                link={{
                  onClick: () => {
                    executeCommand('Help');
                  },
                }}
              >
                {t('Copilot:documentation')}
              </Typography.Text>
              <Typography.Text
                icon={<Github theme="outline" size="16" />}
                strong
                link={{
                  onClick: () => {
                    executeCommand('OpenSource');
                  },
                }}
              >
                GitHub
              </Typography.Text>
            </Space>
          </Space>
        )}
        {messages.map((msg, idx) => {
          const component = mapMessageTypeToComponent[msg.type];
          if (!component) return null;

          const send = sendCurrentMessages;

          const appendMessages = (msgList: IChatMessage<any, any>[]) => {
            messages$.next(messages$.value.slice(0, idx + 1).concat(msgList));
          };

          return React.createElement(component, {
            payload: msg.payload,
            appendMessages,
            sendMessages: (msgList) => {
              appendMessages(msgList);
              send();
            },
            send,
          });
        })}
        {isLoading && (
          <Card title={t('Copilot:thinking')} style={{ width: '100%', height: 200, flexShrink: 0 }} loading>
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
            placeholder={t('Copilot:input_placeholder')}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleSend();
              }
            }}
          />
          {!isLoading && (
            <Button disabled={!userInput} icon={<IconSend />} loading={isLoading} onClick={handleSend}>
              {t('Copilot:send')}
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
              {t('Copilot:stop')}
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
              {t('Copilot:clear')}
            </Button>
          )}
        </Space>
      )}
    </Space>
  );
});
