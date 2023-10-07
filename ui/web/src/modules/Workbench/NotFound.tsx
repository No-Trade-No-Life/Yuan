import { IconClose, IconUndo } from '@douyinfe/semi-icons';
import { Button, Space, Typography } from '@douyinfe/semi-ui';
import { Trans, useTranslation } from 'react-i18next';
import { executeCommand } from '../CommandCenter';
import { registerPage, usePageType } from '../Pages';

registerPage('NotFound', () => {
  const component = usePageType();
  const { t } = useTranslation('NotFound');
  return (
    <Space vertical style={{ width: '100%', height: '100%' }}>
      <Typography.Title heading={4}>{t('page_not_found')}</Typography.Title>
      <Trans t={t} i18nKey={'page_not_found_note'} values={{ component }}></Trans>
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
    </Space>
  );
});
