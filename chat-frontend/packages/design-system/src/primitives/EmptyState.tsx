import type {ReactNode} from "react";

import {cn} from "../lib/cn";

/**
 * Empty state — shown when a query succeeds but returns nothing (empty inbox,
 * no contacts, no search results). Calm, product-facing copy; no internal
 * wording (DESIGN.md §3). Optional single action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="grid size-12 place-items-center rounded-2xl bg-surface text-muted">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-xs text-[0.8125rem] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
