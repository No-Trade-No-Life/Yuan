import { IconClear, IconFolderOpen, IconLink, IconSend } from '@douyinfe/semi-icons';
import { Button, Card, Empty, Space, TextArea, Typography } from '@douyinfe/semi-ui';
import { Book, Github } from '@icon-park/react';
import { useObservableState } from 'observable-hooks';
import { join } from 'path-browserify';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY, Subject, catchError, defer, raceWith, tap, timeout } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { createFileSystemBehaviorSubject } from '../FileSystem';
import i18n from '../Locale/i18n';
import { region$ } from '../Locale/utils';
import { registerPage } from '../Pages';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import CopilotButton from './components/CopilotButton';
import { IChatMessage, IMessageCardProps } from './model';
const mapMessageTypeToComponent: Record<string, React.ComponentType<IMessageCardProps<any>>> = {};

export function registerCopilotMessageBlock<P extends {}>(
  type: string,
  component: React.ComponentType<IMessageCardProps<any>>,
) {
  mapMessageTypeToComponent[type] = component;
}

const API_ENDPOINT = `https://api.ntnl.io/copilot`;

const messages$ = createFileSystemBehaviorSubject<IChatMessage<any, any>[]>('copilotMessages', []);

registerPage('Copilot', () => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const { t } = useTranslation('Copilot');
  const messages = useObservableState(messages$) ?? [];

  const hints = useMemo(
    (): Array<{ onClick?: () => void; content: string; description: string }> => [
      //
      {
        content: t('Copilot:prompt_example1:content'),
        description: t('Copilot:prompt_example1:description'),
        onClick: () => {
          gtag('event', 'copilot_prompt_example1');
          setUserInput(t('Copilot:prompt_example1:prompt'));
        },
      },
      {
        content: t('Copilot:prompt_example2:content'),
        description: t('Copilot:prompt_example2:description'),
        onClick: () => {
          gtag('event', 'copilot_prompt_example2');
          setUserInput('');
          messages$.next(
            messages.concat([
              {
                type: 'CopilotDefaultModels',
                payload: {},
              },
            ]),
          );
        },
      },
      {
        content: t('Copilot:prompt_example3:content'),
        description: t('Copilot:prompt_example3:description'),
        onClick: () => {
          gtag('event', 'copilot_prompt_example3');
          setUserInput(t('Copilot:prompt_example3:prompt'));
        },
      },
    ],
    [messages, t],
  );

  useEffect(() => {
    const sub = messages$.subscribe((messages) => {
      Object.assign(globalThis, { copilotMessages: messages });
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);

  const stop$ = useMemo(() => new Subject<void>(), []);

  const region = useObservableState(region$);

  const sendCurrentMessages = () => {
    defer(async () => {
      if (!messages$.value) {
        return;
      }
      const messagesToSend = messages$.value.filter((v) => v.type !== 'SystemError');
      const res = await fetch(API_ENDPOINT, {
        mode: 'cors',
        method: 'POST',
        body: JSON.stringify({ messages: messagesToSend }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();
      const newMessages: IChatMessage<any, any>[] = json.data.messages;
      messages$.next(messages.concat(newMessages));
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
          messages$.next(messages.concat([{ type: 'SystemError', payload: { error: `${err}` } }]));
          return EMPTY;
        }),
      )
      .subscribe();
  };

  const handleSend = async () => {
    if (!userInput) return;
    gtag('event', 'copilot_push_message');
    gtag('event', 'copilot_push_message_200');
    const theUserInput = userInput;
    messages$.next(
      messages.concat([{ type: 'UserText', payload: { text: theUserInput, language: i18n.language } }]),
    );
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
            <Empty
              image={<img src={join(import.meta.env.BASE_URL, '/yuan.svg')} width={128} height={128}></img>}
            ></Empty>
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
            <Typography.Text style={{ marginTop: '1em' }}>{t('Copilot:try_asking')}</Typography.Text>
            <div
              className={'hintContainer'}
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '1em',
                margin: '1em 4em 0 4em',
              }}
            >
              {hints.map((item) => (
                <CopilotButton
                  style={{
                    width: '220px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                  }}
                  onClick={item.onClick}
                >
                  <Typography.Text type="primary" style={{ fontSize: '1.2em' }}>
                    {item.content}
                  </Typography.Text>
                  <div style={{ marginTop: '8px' }}>
                    <Typography.Text type="secondary">{item.description}</Typography.Text>
                  </div>
                </CopilotButton>
              ))}
            </div>

            <Typography.Text style={{ marginTop: '1em' }}>{t('Copilot:extra_action')}</Typography.Text>
            <Space style={{ flexWrap: 'wrap' }}>
              {typeof (window as any).showDirectoryPicker === 'function' && (
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

          const appendMessage = (msgList: IChatMessage<any, any>[]) => {
            // messages$.next(messages.slice(0, idx + 1).concat(msgList));
            messages$.next(messages.concat(msgList));
          };
          const replaceMessages = (msgList: IChatMessage<any, any>[]) => {
            messages$.next(messages.slice(0, idx + 1).concat(msgList));
          };
          const editMessage = (payload: any) => {
            messages[idx].payload = payload;
            messages$.next(JSON.parse(JSON.stringify(messages)));
          };
          return (
            <ErrorBoundary
              fallback={(props) => {
                return <Typography.Text type="danger">Error: ${`${props.error}`}</Typography.Text>;
              }}
            >
              {React.createElement(component, {
                payload: msg.payload,
                messages,
                replaceMessage: replaceMessages,
                send,
                appendMessage,
                editMessage,
              })}
            </ErrorBoundary>
          );
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
