import { IconRefresh } from '@douyinfe/semi-icons';
import { Button, Empty } from '@douyinfe/semi-ui';
import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError(error: any) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // 你同样可以将错误日志上报给服务器
    console.error(new Error(), 'render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // 你可以自定义降级后的 UI 并渲染
      return (
        <Empty title="错误" description="渲染过程发生错误，请打开 F12 查看问题，并报告给 Yuan 的维护者">
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              this.setState({ hasError: false });
            }}
          >
            重试
          </Button>
        </Empty>
      );
    }

    return this.props.children;
  }
}
