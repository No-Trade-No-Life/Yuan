import { IconClose, IconUndo } from '@douyinfe/semi-icons';
import { Button, Empty, Space, Typography } from '@douyinfe/semi-ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { executeCommand } from '../CommandCenter';
import { usePageType } from '../Pages';

export const NotFound = React.memo(() => {
  const component = usePageType();
  const { t } = useTranslation('NotFound');
  return (
    <Empty
      title={<Typography.Title heading={4}>{t('page_not_found')}</Typography.Title>}
      description={<Trans t={t} i18nKey={'page_not_found_note'} values={{ component }}></Trans>}
    >
      <Space align="center">
        <Button
          icon={<IconUndo />}
          type="primary"
          onClick={() => {
            executeCommand('ResetLayout');
          }}
        >
          {t('reset_layout')}
        </Button>
        <Button
          icon={<IconClose />}
          type="tertiary"
          onClick={() => {
            executeCommand('ClosePage');
          }}
        >
          {t('close_this_only')}
        </Button>
      </Space>
    </Empty>
  );
});
