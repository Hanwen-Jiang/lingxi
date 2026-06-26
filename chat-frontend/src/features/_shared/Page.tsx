import type {ReactNode} from "react";

import {cn} from "@infinitechat/design-system";

/**
 * Utility-page scaffold (DESIGN.md §5): rail (in AppShell) + a constrained
 * primary content panel + an optional focused side panel. Generous top padding,
 * constrained max-width, no edge-to-edge stretch on wide screens.
 */
export function Page({
  title,
  eyebrow,
  actions,
  aside,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div
        className={cn(
          "mx-auto w-full max-w-[1080px] px-5 pb-16 pt-8",
          aside && "lg:flex lg:items-start lg:gap-6",
        )}
      >
        <div className="min-w-0 flex-1">
          <header className="mb-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="truncate text-xl font-semibold tracking-[-0.02em]">{title}</h2>
            </div>
            {actions}
          </header>
          {children}
        </div>
        {aside ? <div className="mt-5 w-full shrink-0 lg:mt-0 lg:w-80">{aside}</div> : null}
      </div>
    </div>
  );
}

/** A compact three-column signal strip (DESIGN.md: phone contacts/settings use a
 *  compact signal strip instead of stacked overview rows). */
export function SignalStrip({items}: {items: {label: string; value: ReactNode}[]}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-[var(--lx-radius-panel)] border border-separator bg-surface">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn("px-4 py-3.5", i > 0 && "border-l border-separator")}
        >
          <div className="text-lg font-semibold tabular-nums leading-tight">{it.value}</div>
          <div className="mt-0.5 text-[0.75rem] text-muted">{it.label}</div>
        </div>
      ))}
    </div>
  );
}
