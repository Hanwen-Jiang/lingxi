import {cn} from "../lib/cn";

export type ConnectionState = "online" | "connecting" | "reconnecting" | "offline";

const COPY: Record<Exclude<ConnectionState, "online">, string> = {
  connecting: "正在连接…",
  reconnecting: "网络不稳,正在重新连接…",
  offline: "已离线,消息会在恢复后自动发送",
};

/**
 * Connection banner — surfaces WS connection state (offline / reconnecting).
 * Quiet amber, single line, never a large alarming bar. Renders nothing when
 * online, and is positioned by the caller so it doesn't shift content
 * (DESIGN.md: conditional elements use floating/overlay positioning).
 */
export function ConnectionBanner({state, className}: {state: ConnectionState; className?: string}) {
  if (state === "online") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-1.5 text-[0.75rem] font-medium",
        "bg-[color-mix(in_oklch,var(--lx-state-offline)_14%,var(--surface))] text-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-[var(--lx-state-offline)]",
          state !== "offline" && "animate-pulse",
        )}
        aria-hidden="true"
      />
      {COPY[state]}
    </div>
  );
}

/** Presence/connection dot — a quiet semantic signal, never a filled badge. */
export function StatusDot({
  state,
  className,
  label,
}: {
  state: "online" | "offline" | "away";
  className?: string;
  label?: string;
}) {
  const color =
    state === "online"
      ? "var(--lx-state-online)"
      : state === "away"
        ? "var(--lx-state-offline)"
        : "color-mix(in oklch, var(--foreground) 28%, transparent)";
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("inline-block size-2 rounded-full", className)}
      style={{backgroundColor: color}}
    />
  );
}
