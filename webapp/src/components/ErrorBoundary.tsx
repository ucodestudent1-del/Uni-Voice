import React from "react";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-alt">
          <div className="text-center max-w-md px-6">
            <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text dark:status-error-text dark:bg-error-bg mb-4">
              Something went wrong. Please try again.
            </div>
            {this.state.error && (
              <p className="text-xs text-tertiary mb-4 font-mono">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = "/login")}
                className="rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
