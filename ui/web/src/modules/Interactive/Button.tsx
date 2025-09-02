import { Modal, Button as SemiButton } from '@douyinfe/semi-ui';
import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
import React, { useState } from 'react';
import { Toast } from './Toast';
import { showForm } from '../Form';

/**
 * Yuan Button Component
 *
 * - Button must display loading status after clicking
 * - Button displays loading if and only if click event processing
 * - We need to know whether the backend click event is processing or not.
 */
export const Button = React.memo(
  (
    props: Omit<ButtonProps, 'onClick' | 'loading'> & {
      onClick?: () => any;
      doubleCheck?: { title: React.ReactNode; description?: React.ReactNode };
    },
  ) => {
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
            const doubleCheck = props.doubleCheck;
            if (doubleCheck) {
              const confirmed = await new Promise((res) =>
                Modal.confirm({
                  title: doubleCheck.title,
                  content: doubleCheck.description,
                  okText: '确认',
                  cancelText: '取消',
                  onCancel: () => res(false),
                  onOk: () => res(true),
                }),
              );
              if (!confirmed) {
                throw new Error('User Cancelled');
              }
            }
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
