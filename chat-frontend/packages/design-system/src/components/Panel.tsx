import type {HTMLAttributes, ReactNode} from "react";

import {cn} from "../lib/cn";

/**
 * Top-level rounded panel (DESIGN.md: cards 18–32px radius, visible-but-soft
 * borders, subtle shadow in light / reduced in dark). Reserve these for
 * top-level surfaces — do NOT nest panels (avoid card-in-card fatigue); use
 * DividerRow inside instead.
 */
export function Panel({
  className,
  children,
  size = "md",
  ...rest
}: HTMLAttributes<HTMLDivElement> & {size?: "md" | "lg"}) {
  return (
    <div
      className={cn(
        "min-w-0 border border-separator bg-surface",
        size === "lg"
          ? "rounded-[var(--lx-radius-panel-lg)]"
          : "rounded-[var(--lx-radius-panel)]",
        "shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_6%,transparent)] dark:shadow-none",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * A flat list/setting row with a precise bottom divider — the DESIGN.md
 * alternative to nesting cards. Left blue accent rail optional for active rows.
 */
export function DividerRow({
  className,
  children,
  active = false,
  last = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {active?: boolean; last?: boolean}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-3 px-4 py-3",
        !last && "border-b border-separator",
        active && "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--lx-accent)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Compact section label — short, high-weight, tracked (DESIGN.md §3). */
export function SectionLabel({children, className}: {children: ReactNode; className?: string}) {
  return (
    <p
      className={cn(
        "px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
