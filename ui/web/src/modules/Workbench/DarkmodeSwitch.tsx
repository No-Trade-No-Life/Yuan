import { IconMoon, IconSun } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { DarkModeSetting$, isDarkMode$ } from './darkmode';

export const DarkmodeSwitch = React.memo(() => {
  const isDark = useObservableState(isDarkMode$);
  const setting = useObservableState(DarkModeSetting$) || 'auto';
  return (
    <Button
      icon={isDark ? <IconMoon /> : <IconSun />}
      theme="borderless"
      type="tertiary"
      onClick={() => {
        const options = ['dark', 'light', 'auto'] as const;
        const idx = options.indexOf(setting);
        const nextIdx = (idx + 1) % options.length;
        const nextOption = options[nextIdx] || 'auto';
        DarkModeSetting$.next(nextOption);
      }}
    >
      {setting === 'auto' && 'AUTO'}
    </Button>
  );
});
