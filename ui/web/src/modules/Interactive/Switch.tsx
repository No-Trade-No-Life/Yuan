import { Switch as SemiSwitch } from '@douyinfe/semi-ui';
import { SwitchProps } from '@douyinfe/semi-ui/lib/es/switch';
import React, { useState } from 'react';

/**
 * Yuan Switch Component
 *
 * - Switch must display loading status after clicking
 * - Switch displays loading if and only if click event processing
 * - We need to know whether the backend click event is processing or not.
 */
export const Switch = React.memo(
  (props: Omit<SwitchProps, 'onChange' | 'loading'> & { onChange?: (checked: boolean) => any }) => {
    const [isLoading, setLoading] = useState(false);
    return (
      <SemiSwitch
        {...props}
        // loading has higher priority than disabled
        disabled={isLoading ? false : props.disabled}
        loading={isLoading}
        onChange={async (checked) => {
          setLoading(true);
          try {
            await props.onChange?.(checked);
          } catch (e) {}
          setLoading(false);
        }}
      />
    );
  },
);
