import { IconAlertCircle } from '@douyinfe/semi-icons';
import { Modal } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import React, { useMemo } from 'react';
import { Button } from '../Interactive';

export class ErrorBoundary extends React.Component<{
  fallback?: React.ComponentType<{ error: any; reset: () => void }>;
  children: React.ReactNode;
}> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      if (Fallback) {
        return (
          <Fallback
            error={this.state.error}
            reset={() => {
              this.setState({ hasError: false });
            }}
          />
        );
      }
      return null;
    }

    return this.props.children;
  }
}

export const DefaultErrorFallback = ({ error, reset }: { error: any; reset: () => void }) => {
  const isDev = useMemo(() => new URL(document.location.href).searchParams.get('mode') === 'development', []);

  console.error(formatTime(Date.now()), error);

  return (
    <Button
      icon={<IconAlertCircle />}
      type="danger"
      onClick={async () => {
        if (isDev) {
          await new Promise((resolve, reject) => {
            Modal.error({
              title: `Error: ${error.message || error.toString()}`,
              width: '80vw',
              content: <div>{error.stack && <pre>{error.stack}</pre>}</div>,
              onOk: () => resolve(true),
              onCancel: () => reject(new Error('User Cancelled')),
              okText: 'Reload',
              hasCancel: false,
            });
          });
        }

        reset();
      }}
    >
      ERROR
    </Button>
  );
};
