"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-bg-surface border border-error/30 rounded-lg p-6 text-center">
          <AlertCircle size={24} className="text-error mx-auto mb-2" />
          <p className="text-sm text-text-primary mb-1">
            {this.props.fallbackMessage || "Something went wrong"}
          </p>
          <p className="text-xs text-text-muted mb-3">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-elevated border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <RotateCcw size={12} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
