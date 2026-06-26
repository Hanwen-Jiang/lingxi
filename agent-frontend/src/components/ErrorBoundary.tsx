import {Component, type ErrorInfo, type ReactNode} from "react";

import {ErrorState, LingxiGlyph} from "@infinitechat/design-system";

type ErrorBoundaryProps = {children: ReactNode};

type ErrorBoundaryState = {hasError: boolean};

// Top-level safety net: if any part of the workspace throws while rendering,
// we swap the broken subtree for the shared 灵犀 (Lingxi) error state instead
// of a blank screen. ErrorState (from the design system) handles the calm,
// product-facing copy — no stack traces or internal wording leaks.
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
      <div className="flex h-svh w-full flex-col items-center justify-center bg-background p-6 text-foreground">
        <LingxiGlyph className="size-10 text-accent" title="灵犀" />
        <div className="mt-4 w-full max-w-sm">
          <ErrorState
            title="灵犀 暂时打了个盹"
            description="刚才工作台没能加载出来,你的对话还在,刷新一下再试。"
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }
}
