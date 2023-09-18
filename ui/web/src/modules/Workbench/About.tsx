import { Descriptions, Space, Typography } from '@douyinfe/semi-ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { userTimezone } from '../Locale/utils';

export const About = React.memo(() => {
  const { t, i18n } = useTranslation('About');
  return (
    <Space style={{ padding: '2em' }}>
      <Descriptions
        data={[
          {
            key: t('build_version'),
            value: (
              <Typography.Text
                link={{
                  target: '_blank',
                  href: `https://github.com/No-Trade-No-Life/Yuan/tree/${__COMMIT_HASH__}`,
                }}
                copyable
              >
                {__COMMIT_HASH__}
              </Typography.Text>
            ),
          },
          {
            key: t('timezone'),
            value: userTimezone,
          },
          {
            key: t('language'),
            value: i18n.language,
          },
        ]}
      />
    </Space>
  );
});
