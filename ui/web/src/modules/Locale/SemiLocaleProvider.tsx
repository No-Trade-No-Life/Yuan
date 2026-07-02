import { ConfigProvider } from '@douyinfe/semi-ui';
import en_US from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Drives Semi UI's built-in component text (date pickers, pagination, default
 * modal buttons, empty states, etc.) from the app's i18next language.
 *
 * Semi resolves component locale from `ConfigProvider`'s `locale` prop, which
 * defaults to `zh_CN`. Without this, those components render in Chinese even
 * when the app language is English. Note a separate `LocaleProvider` does NOT
 * work here: `ConfigProvider`'s locale takes precedence over it.
 */
export const SemiLocaleProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || 'en';
  const locale = language.startsWith('zh') ? zh_CN : en_US;
  return (
    <ConfigProvider locale={locale} getPopupContainer={() => document.getElementById('root') as HTMLElement}>
      {children}
    </ConfigProvider>
  );
};
