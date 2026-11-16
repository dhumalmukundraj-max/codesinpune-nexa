import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Er.NEXA Uncaught Error Boundary]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-6 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {this.props.fallbackTitle || 'Knowledge Handover Display Error'}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                An unexpected display error occurred while rendering the report. Your data is safely preserved.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2 bg-stone-50 rounded-lg text-[11px] font-mono text-stone-600 break-words text-left">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Home className="w-3.5 h-3.5" />
                Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
