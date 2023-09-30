import React from 'react';

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
      const Fallback = this.props.fallback;
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
