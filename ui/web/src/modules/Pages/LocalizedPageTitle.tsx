import React from 'react';
import { Trans } from 'react-i18next';
import i18n from '../Locale/i18n';

export const LocalizePageTitle: React.ComponentType<{ type: string; params?: any }> = (props) => {
  const i18nKey = `pages:${props.type}`;
  if (i18n.exists(i18nKey)) {
    return (
      <Trans i18nKey={i18nKey} values={props.params} tOptions={{ interpolation: { escapeValue: false } }} />
    );
  }
  return <>{props.type}</>;
};
