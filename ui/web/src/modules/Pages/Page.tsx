import { Button, ButtonGroup, Space, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { useObservableState } from 'observable-hooks';
import React, { useContext, useEffect, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { executeCommand } from '../CommandCenter';
import { ErrorBoundary } from './ErrorBoundary';
import { AvailableComponents, pageRegistered$ } from './model';
import { IconClose, IconRefresh } from '@douyinfe/semi-icons';
import { Bug } from '@icon-park/react';

interface IPage {
  id: string;
  type: string;
  params: any;
  viewport: { w: number; h: number; x: number; y: number };
}

const PageContext = React.createContext<IPage | null>(null);

export const Page = React.memo((props: { page: IPage }) => {
  useObservableState(pageRegistered$);
  const { t } = useTranslation('Page');
  const Component = AvailableComponents[props.page.type] || AvailableComponents['NotFound'];
  const isDev = useMemo(() => new URL(document.location.href).searchParams.get('mode') === 'development', []);
  return (
    <ErrorBoundary
      fallback={({ error, reset }) => {
        console.error(formatTime(Date.now()), error);
        return (
          <Space vertical>
            <Typography.Title heading={3}>{t('Page:render_error', { message: `${error}` })}</Typography.Title>
            {isDev && (
              <>
                <Trans t={t} i18nKey={'Page:render_error_hint'} />
                <Typography.Text style={{ whiteSpace: 'pre' }} copyable>
                  {error.stack}
                </Typography.Text>
              </>
            )}
            <ButtonGroup>
              <Button
                icon={<IconClose />}
                onClick={() => {
                  executeCommand('ClosePage');
                }}
              >
                {t('common:close')}
              </Button>
              <Button
                icon={<IconRefresh />}
                onClick={() => {
                  reset();
                }}
              >
                {t('common:retry')}
              </Button>
            </ButtonGroup>
          </Space>
        );
      }}
    >
      <PageContext.Provider value={props.page}>{Component ? <Component /> : null}</PageContext.Provider>
    </ErrorBoundary>
  );
});

export const usePageParams = function <T = any>(): T {
  const page = useContext(PageContext);
  return page?.params ?? {};
};

export const usePageTitle = (title: string) => {
  const page = useContext(PageContext);
  const pageId = page?.id;

  // ISSUE: node cannot be treat as deps. Or it will cause infinite rendering
  // (node change -> rename tab -> layout change -> node change -> ...)
  useEffect(() => {
    if (pageId) {
      executeCommand('Page.changeTitle', { pageId, title });
    }
  }, [title, pageId]);
};

export const usePageType = () => {
  const page = useContext(PageContext);
  return page?.type ?? '';
};

export const usePageViewport = () => {
  const page = useContext(PageContext);
  return page?.viewport;
};

export const usePageId = () => {
  const page = useContext(PageContext);
  return page?.id ?? '';
};
