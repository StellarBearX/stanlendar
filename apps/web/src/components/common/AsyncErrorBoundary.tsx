'use client';

import React, { Component, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  fallback?: ReactNode;
}

interface State {
  hasAsyncError: boolean;
  asyncError?: Error;
}

export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasAsyncError: false,
    };
  }

  componentDidMount() {
    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Only handle errors that look like they're from our app
    if (this.isAppError(event.reason)) {
      this.setState({
        hasAsyncError: true,
        asyncError: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      });
      
      // Prevent the error from being logged to console
      event.preventDefault();
    }
  };

  private isAppError = (error: any): boolean => {
    // Check if error is from our API or components
    if (error instanceof Error) {
      const stack = error.stack || '';
      return stack.includes('/src/') || 
             stack.includes('api.ts') || 
             error.message.includes('fetch');
    }
    return false;
  };

  private handleRetry = () => {
    this.setState({
      hasAsyncError: false,
      asyncError: undefined,
    });
    
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasAsyncError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-8">
          <div className="max-w-sm w-full bg-white rounded-lg border border-red-200 p-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Operation Failed
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              {this.state.asyncError?.message || 'An unexpected error occurred'}
            </p>

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return (
      <ErrorBoundary>
        {this.props.children}
      </ErrorBoundary>
    );
  }
}

// Higher-order component for wrapping components with async error handling
export function withAsyncErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  onRetry?: () => void,
) {
  return function WrappedComponent(props: P) {
    return (
      <AsyncErrorBoundary onRetry={onRetry}>
        <Component {...props} />
      </AsyncErrorBoundary>
    );
  };
}