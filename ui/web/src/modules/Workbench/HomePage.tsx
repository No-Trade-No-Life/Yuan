import { Empty } from '@douyinfe/semi-ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const HomePage = React.memo(() => {
  const { t } = useTranslation('HomePage');

  return <Empty title={t('welcome')}>{t('guide')}</Empty>;
});
