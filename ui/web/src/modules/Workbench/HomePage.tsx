import { Avatar, Space, Typography } from '@douyinfe/semi-ui';
import hotkeys from 'hotkeys-js';
import { useObservable, useObservableState } from 'observable-hooks';
import { join } from 'path-browserify';
import React from 'react';
import { Observable, defer, mergeMap, pipe, repeat, retry, switchMap } from 'rxjs';
import { createPersistBehaviorSubject } from '../BIOS';
import { fs } from '../FileSystem';
import { pageRegistered$ } from '../Pages';
import { executeAssociatedRule } from '../Workspace';

export const isShowHome$ = createPersistBehaviorSubject('show-home', true);

export const toggleShowHome = () => {
  isShowHome$.next(!isShowHome$.value);
};

// ALT+D: Toggle SHOW HOME
hotkeys('alt+d', () => {
  toggleShowHome();
});

const useElementSize = (element?: Element | null) =>
  useObservableState(
    useObservable(
      pipe(
        switchMap(
          ([element]) =>
            new Observable<DOMRectReadOnly>((subscriber) => {
              const resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                  subscriber.next(entry.contentRect);
                }
              });
              if (element) resizeObserver.observe(element);
              return () => {
                resizeObserver.disconnect();
              };
            }),
        ),
      ),
      [element],
    ),
  );

const DESKTOP_DIR = '/.Y/desktop';
export const HomePage = React.memo(() => {
  const size = useElementSize(document.body);

  useObservableState(pageRegistered$);

  const isRowFlow = size && size.width < 1024;

  const iconSize = 60;
  const gapSize = size ? (size.width > 1024 ? 20 : Math.floor((size.width - 4 * iconSize) / 5)) : 14;
  console.info('HomePage', 'size', { iconSize, gapSize, width: size?.width, isRowFlow });

  const files =
    useObservableState(
      useObservable(
        pipe(
          mergeMap(() =>
            defer(() => fs.readdir(DESKTOP_DIR)).pipe(
              //
              repeat({ delay: 1000 }),
              retry({ delay: 1000 }),
            ),
          ),
        ),
        [],
      ),
    ) || [];

  if (!size) return null;

  return (
    <Space
      vertical
      align="start"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          padding: gapSize,
          width: '100%',
          height: isRowFlow ? undefined : '100%',
          gridTemplateColumns: `repeat(auto-fit, ${iconSize}px)`,
          gridTemplateRows: `repeat(auto-fit, ${iconSize + 20}px)`,
          gap: gapSize,
          boxSizing: 'border-box',
          gridAutoFlow: isRowFlow ? 'row' : 'column',
        }}
      >
        {files
          .sort((a, b) => a.localeCompare(b))
          .map((filename) => {
            const filePath = join(DESKTOP_DIR, filename);
            return (
              <div
                key={filename}
                style={{
                  width: iconSize,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease-in-out',
                }}
              >
                <Avatar
                  shape="square"
                  src="/yuan.svg"
                  style={{ width: iconSize, height: iconSize }}
                  onClick={() => executeAssociatedRule(filePath)}
                />
                <Typography.Text
                  ellipsis={{
                    showTooltip: true,
                  }}
                  style={{ width: iconSize, textAlign: 'center' }}
                >
                  {filename}
                </Typography.Text>
              </div>
            );
          })}
      </div>
    </Space>
  );
});
