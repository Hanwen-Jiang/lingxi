import {RotateCw} from "lucide-react";

import {cn} from "../lib/cn";

/**
 * Error state — shown when a query/mutation fails. Retryable. Shows a calm,
 * user-facing message and NEVER leaks raw backend error strings, status codes,
 * or endpoint/gateway wording (DESIGN.md §3 / §7). An optional `traceId` may be
 * shown as a small, quiet reference for support without exposing internals.
 */
export function ErrorState({
  title = "出了点问题",
  description = "刚才没能加载出来,再试一次。",
  onRetry,
  traceId,
  className,
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  traceId?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-3 text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-xs text-[0.8125rem] leading-relaxed text-muted">{description}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-separator px-3.5 py-1.5 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lx-accent)]"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          重试
        </button>
      ) : null}
      {traceId ? <p className="text-[0.6875rem] tabular-nums text-muted/70">ref {traceId}</p> : null}
    </div>
  );
}
