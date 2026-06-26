import {AlertCircle, Check, CheckCheck, Clock} from "lucide-react";

import {cn} from "../lib/cn";

/** Optimistic send lifecycle for a message bubble (see ADR 0002 §5/§6). */
export type DeliveryState = "sending" | "sent" | "delivered" | "read" | "failed";

/**
 * Delivery tick for own messages. `sending` (optimistic) → `sent`/`delivered`/
 * `read`, or `failed` with a retry affordance. Tiny and quiet; the only colored
 * variant is `read` (accent) and `failed` (danger).
 */
export function DeliveryTick({
  state,
  onRetry,
  className,
}: {
  state: DeliveryState;
  onRetry?: () => void;
  className?: string;
}) {
  if (state === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--lx-state-error)] hover:underline",
          className,
        )}
      >
        <AlertCircle className="size-3" aria-hidden="true" />
        发送失败,重试
      </button>
    );
  }
  const icon =
    state === "sending" ? (
      <Clock className="size-3 animate-pulse text-muted" aria-hidden="true" />
    ) : state === "read" ? (
      <CheckCheck className="size-3.5 text-[var(--lx-accent)]" aria-hidden="true" />
    ) : state === "delivered" ? (
      <CheckCheck className="size-3.5 text-muted" aria-hidden="true" />
    ) : (
      <Check className="size-3.5 text-muted" aria-hidden="true" />
    );
  const label =
    state === "sending"
      ? "发送中"
      : state === "read"
        ? "已读"
        : state === "delivered"
          ? "已送达"
          : "已发送";
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={label} role="img">
      {icon}
    </span>
  );
}

/** Quiet unread count badge (accent). Caps at 99+. */
export function UnreadBadge({count, className}: {count: number; className?: string}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-grid min-w-5 place-items-center rounded-full bg-[var(--lx-accent)] px-1.5 text-[0.6875rem] font-semibold leading-5 text-white",
        className,
      )}
      aria-label={`${count} 条未读`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Status pill — neutral surface + a tiny semantic dot, per DESIGN.md (never a
 * large filled green badge, especially on pure-black dark screens).
 */
export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "neutral" | "online" | "warning" | "danger";
  className?: string;
}) {
  const dot =
    tone === "online"
      ? "var(--lx-state-online)"
      : tone === "warning"
        ? "var(--lx-state-offline)"
        : tone === "danger"
          ? "var(--lx-state-error)"
          : "color-mix(in oklch, var(--foreground) 30%, transparent)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[0.75rem] font-medium text-muted",
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{backgroundColor: dot}} aria-hidden="true" />
      {label}
    </span>
  );
}
