import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../lib/logger';
import { ErrorState } from '../ui/ErrorState';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    logger.error('Uncaught component error in React tree', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
          <div className="max-w-md w-full">
            <ErrorState
              title="System Component Error"
              message="A component experienced an unexpected runtime fault. Technical diagnostics have been safely captured."
              code={this.state.error?.name || 'REACT_RUNTIME_ERROR'}
              onRetry={() => window.location.reload()}
              onReset={this.handleReset}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
