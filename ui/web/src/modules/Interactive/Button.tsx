import { Button as SemiButton } from '@douyinfe/semi-ui';
import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
import React, { useState } from 'react';
import { Toast } from './Toast';

/**
 * Yuan Button Component
 *
 * - Button must display loading status after clicking
 * - Button displays loading if and only if click event processing
 * - We need to know whether the backend click event is processing or not.
 */
export const Button = React.memo(
  (props: Omit<ButtonProps, 'onClick' | 'loading'> & { onClick?: () => any }) => {
    const [isLoading, setLoading] = useState(false);
    return (
      <SemiButton
        {...props}
        // loading has higher priority than disabled
        disabled={isLoading ? false : props.disabled}
        loading={isLoading}
        onClick={async (e) => {
          setLoading(true);
          try {
            await props.onClick?.();
          } catch (e) {
            Toast.error(`${e}`);
          }
          setLoading(false);
        }}
      />
    );
  },
);
