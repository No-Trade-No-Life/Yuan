import { Avatar, Space, Typography } from '@douyinfe/semi-ui';
import { useObservable, useObservableState } from 'observable-hooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject, Observable, pipe, switchMap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { pageRegistered$ } from '../Pages';

export const isShowHome$ = new BehaviorSubject(true);

export const toggleShowHome = () => {
  isShowHome$.next(!isShowHome$.value);
};

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

export const HomePage = React.memo(() => {
  const { t } = useTranslation('HomePage');

  const size = useElementSize(document.body);

  useObservableState(pageRegistered$);

  const isRowFlow = size && size.width < 1024;
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
          padding: 20,
          width: '100%',
          height: isRowFlow ? undefined : '100%',
          gridTemplateColumns: 'repeat(auto-fit, 80px)',
          gridTemplateRows: 'repeat(auto-fit, 100px)',
          gap: 20,
          boxSizing: 'border-box',
          gridAutoFlow: isRowFlow ? 'row' : 'column',
        }}
      >
        {Object.keys(Modules.Pages.AvailableComponents)
          .sort((a, b) => a.localeCompare(b))
          .map((pageId) => {
            const name = t(`pages:${pageId}`);
            return (
              <div
                key={pageId}
                style={{
                  width: 80,
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
                  style={{ width: 80, height: 80 }}
                  onClick={() => {
                    executeCommand(pageId);
                  }}
                >
                  {name.slice(0, 1)}
                </Avatar>
                <Typography.Text
                  ellipsis={{
                    showTooltip: {
                      opts: {
                        content: `${name} (${pageId})`,
                      },
                    },
                  }}
                  style={{ width: 80 }}
                >
                  {name}
                </Typography.Text>
              </div>
            );
          })}
      </div>
    </Space>
  );
});
