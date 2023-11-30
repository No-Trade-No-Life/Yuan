import { IconLanguage } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import React from 'react';
import { executeCommand } from '../CommandCenter';

export const LanguageSelector = React.memo(() => {
  return (
    <Button
      icon={<IconLanguage />}
      type="tertiary"
      theme="borderless"
      onClick={() => {
        executeCommand('ChangeLanguage');
      }}
    />
  );
});
