import {Component, type ErrorInfo, type ReactNode} from "react";

import {ErrorState} from "@infinitechat/design-system";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** App-level error boundary (P0 hygiene). Shows a calm, user-facing fallback —
 *  no stack traces or internal wording in the UI (DESIGN.md §7). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(): State {
    return {hasError: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Dev-only diagnostics; never surfaced to the user.
    if (import.meta.env.DEV) console.error("ErrorBoundary", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-background">
          <ErrorState
            title="页面出了点问题"
            description="刷新一下通常就好了。"
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
