import { Descriptions, Space, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
import { region$, userTimezone } from '../Locale/utils';
import { registerPage } from '../Pages';

registerPage('About', () => {
  const { t, i18n } = useTranslation('About');
  const region = useObservableState(region$);
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
            key: t('built_at'),
            value: formatTime(__BUILT_AT__),
          },
          {
            key: t('region'),
            value: region,
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
