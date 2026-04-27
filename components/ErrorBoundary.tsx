import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-500/20 rounded-full">
                <AlertTriangle size={48} className="text-red-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6 text-sm">
              We've encountered an unexpected error. Our team has been notified.
            </p>
            
            {this.state.error && (
              <div className="bg-black/30 p-4 rounded-xl text-left mb-6 overflow-auto max-h-32 text-xs font-mono text-red-300">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-tt-blue hover:bg-blue-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
