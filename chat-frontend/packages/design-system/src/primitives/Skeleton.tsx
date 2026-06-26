import {cn} from "../lib/cn";

/**
 * Loading placeholder. DESIGN.md prefers skeletons over spinners for content
 * regions. Animation is auto-disabled under prefers-reduced-motion (tokens.css).
 */
export function Skeleton({className}: {className?: string}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]",
        className,
      )}
    />
  );
}

/** A skeleton shaped like a conversation row (avatar + two lines). */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/** A list of skeleton rows for an inbox/contacts loading state. */
export function SkeletonList({rows = 6}: {rows?: number}) {
  return (
    <div aria-busy="true" aria-live="polite" className="min-w-0">
      {Array.from({length: rows}, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
