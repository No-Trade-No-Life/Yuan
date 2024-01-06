import { IconCommand, IconSearch } from '@douyinfe/semi-icons';
import { Button, Input, List, Popover, Space, Toast } from '@douyinfe/semi-ui';
import { Fzf } from 'fzf';
import hotkeys from 'hotkeys-js';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import './CommandCenter.css';

export const openCommandCenterAction$ = new Subject<void>();

interface ICommand {
  id: string;
  handler: (params: any) => void | Promise<void>;
}

const commandList$ = new BehaviorSubject<ICommand[]>([]);

const isCommandCenterOpen$ = new BehaviorSubject(false);

export const registerCommand = (id: string, handler: (params: any) => void) => {
  commandList$.next([...commandList$.value.filter((cmd) => cmd.id !== id), { id, handler }]);
};

export const executeCommand = async (id: string, params = {}) => {
  const command = commandList$.value.find((cmd) => cmd.id === id);
  if (!command) {
    Toast.error(`${t('CommandCenter:command_not_found')}: ${id}`);
  }
  const maybePromise = command?.handler(params);
  if (maybePromise instanceof Promise) {
    await maybePromise;
  }
};

const HighlightChars = (props: { str: string; indices: Set<number> }) => {
  const chars = props.str.split('');

  const nodes = chars.map((char, i) => {
    if (props.indices.has(i)) {
      return <b key={i}>{char}</b>;
    } else {
      return char;
    }
  });

  return <>{nodes}</>;
};

export const CommandCenter = React.memo(() => {
  const { t, i18n } = useTranslation(['CommandCenter', 'commands']);
  const isCommandCenterOpen = useObservableState(isCommandCenterOpen$);
  const commandList = useObservableState(commandList$.pipe(debounceTime(50)), []);

  useEffect(() => {
    const key = 'command+k,ctrl+k';
    hotkeys(key, () => {
      isCommandCenterOpen$.next(true);
    });
    return () => {
      hotkeys.unbind(key);
    };
  }, []);

  const fzf = useMemo(() => new Fzf(commandList, { selector: (cmd) => cmd.id }), [commandList]);

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isCommandCenterOpen) {
      setSearch('');
    }
  }, [isCommandCenterOpen]);

  const list = useMemo(() => fzf.find(search || ''), [fzf, search]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  // reset index = 0 when list changed
  useEffect(() => {
    setSelectedIndex(0);
  }, [list]);

  useEffect(() => {
    // @ts-ignore
    document.getElementsByClassName('CommandCenterListItem is-selected')[0]?.scrollIntoViewIfNeeded(false);
  }, [selectedIndex]);

  return (
    <Popover
      contentClassName="CommandCenter"
      visible={isCommandCenterOpen}
      content={({ initialFocusRef }) => (
        <Space vertical align="start" style={{ width: '100%' }}>
          <List
            className="CommandCenterList"
            style={{ width: '100%' }}
            dataSource={list}
            split={false}
            emptyContent={t('no_match_results')}
            header={
              <Input
                ref={initialFocusRef as any}
                onCompositionEnd={(v) => {
                  setSearch(v.currentTarget.value);
                }}
                onChange={(v) => (!v ? setSearch('') : setSearch(v))}
                onKeyDown={(e) => {
                  if (list.length > 0) {
                    if (e.key === 'ArrowUp') {
                      setSelectedIndex((x) => (x - 1 + list.length) % list.length);
                    }
                    if (e.key === 'ArrowDown') {
                      setSelectedIndex((x) => (x + 1) % list.length);
                    }
                  }
                }}
                onEnterPress={() => {
                  const commandId = list[selectedIndex]?.item.id;
                  if (commandId) {
                    executeCommand(commandId);
                  }
                  isCommandCenterOpen$.next(false);
                }}
                prefix={<IconSearch />}
                placeholder={t('command_placeholder')}
              />
            }
            renderItem={(item, idx) => (
              <List.Item
                className={`CommandCenterListItem ${idx === selectedIndex ? 'is-selected' : ''}`}
                onClick={() => {
                  isCommandCenterOpen$.next(false);
                  executeCommand(item.item.id, {});
                }}
              >
                <Space vertical align="start">
                  {i18n.exists(`commands:${item.item.id}`) && <div>{t(`commands:${item.item.id}`)}</div>}
                  <div>
                    <HighlightChars str={item.item.id} indices={item.positions} />
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </Space>
      )}
      style={{ width: '30vw', minWidth: 200, marginTop: -40 }}
      trigger="custom"
      onClickOutSide={() => {
        isCommandCenterOpen$.next(false);
      }}
      onEscKeyDown={() => {
        isCommandCenterOpen$.next(false);
      }}
    >
      <Button
        icon={<IconCommand />}
        type="tertiary"
        style={{ width: '30vw', border: '1px solid', borderColor: 'var(--semi-color-text-3)' }}
        onClick={() => {
          isCommandCenterOpen$.next(true);
        }}
      >
        {t('Go')} (cmd+K)
      </Button>
    </Popover>
  );
});
