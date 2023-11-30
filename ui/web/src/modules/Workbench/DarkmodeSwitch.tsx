import { IconMoon, IconSun } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { isDarkMode$ } from './darkmode';

export const DarkmodeSwitch = React.memo(() => {
  const isDark = useObservableState(isDarkMode$);
  return (
    <Button
      icon={isDark ? <IconMoon /> : <IconSun />}
      theme="borderless"
      type="tertiary"
      onClick={() => {
        isDarkMode$.next(!isDark);
      }}
    />
  );
});
