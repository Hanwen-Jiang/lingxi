import {Component, type ErrorInfo, type ReactNode} from "react";

import {Button} from "@heroui/react/button";

type ErrorBoundaryProps = {children: ReactNode};

type ErrorBoundaryState = {hasError: boolean};

// Top-level safety net: if any part of the workspace throws while rendering,
// we swap the broken subtree for a calm, on-brand recovery card instead of a
// blank screen. The copy stays warm and product-facing (灵犀/Lingxi) — no
// internal terms or stack traces leak into the UI.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {hasError: false};

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {hasError: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("灵犀 hit an unexpected error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-svh w-full items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm rounded-2xl border border-separator bg-surface p-7 text-center shadow-[var(--shadow-elevated)]">
          <h1 className="text-lg font-semibold">灵犀 needs a moment</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Something slipped while loading your workspace. Your conversations are safe — let&rsquo;s try that again.
          </p>
          <Button className="mt-6 w-full justify-center" variant="primary" onPress={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
