import {cn} from "../lib/cn";
import {StatusDot} from "../primitives/connection";

const SIZES = {sm: "size-8", md: "size-10", lg: "size-11", xl: "size-12"} as const;

/**
 * Avatar with initials fallback and an optional presence dot. Single neutral
 * surface; no colored ring unless there's a real presence signal.
 */
export function Avatar({
  name,
  src,
  size = "md",
  presence,
  className,
}: {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
  presence?: "online" | "offline" | "away";
  className?: string;
}) {
  const initials = name.trim().slice(0, 2);
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(SIZES[size], "rounded-xl object-cover")}
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            SIZES[size],
            "grid place-items-center rounded-xl bg-[color-mix(in_oklch,var(--lx-accent)_14%,var(--surface))] text-[0.8125rem] font-semibold text-[var(--lx-accent)]",
          )}
        >
          {initials}
        </span>
      )}
      {presence ? (
        <StatusDot
          state={presence}
          label={presence === "online" ? "在线" : presence === "away" ? "离开" : "离线"}
          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[var(--background)]"
        />
      ) : null}
    </span>
  );
}
