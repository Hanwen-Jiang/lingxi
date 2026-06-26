import {cn} from "../lib/cn";

/**
 * 灵犀 (Lingxi) brand glyph — an abstract "心有灵犀一点通" mark: two facing arcs
 * meeting at a single connecting point. One color (currentColor), so it themes
 * and works on the rail, topbar, and auth hero alike (DESIGN.md: single-color
 * linear glyphs, no emoji). Set color via text-* / className.
 */
export function LingxiGlyph({className, title}: {className?: string; title?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-6", className)}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M8.7 4.6A8 8 0 0 0 8.7 19.4"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M15.3 4.6A8 8 0 0 1 15.3 19.4"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.15" fill="currentColor" />
    </svg>
  );
}

type LogoVariant = "glyph" | "wordmark" | "lockup";

/**
 * Lingxi logo. `glyph` = mark only; `wordmark` = 灵犀 + Lingxi text; `lockup` =
 * mark + wordmark. The mark uses the brand accent by default; pass a className
 * to recolor (e.g. monochrome on the rail).
 */
export function LingxiLogo({
  variant = "lockup",
  className,
  glyphClassName,
  showLatin = true,
}: {
  variant?: LogoVariant;
  className?: string;
  glyphClassName?: string;
  showLatin?: boolean;
}) {
  if (variant === "glyph") {
    return <LingxiGlyph title="灵犀" className={cn("text-[#006fee]", glyphClassName)} />;
  }

  const wordmark = (
    <span className="flex items-baseline gap-1.5 leading-none">
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-foreground">灵犀</span>
      {showLatin ? (
        <span className="text-[0.8125rem] font-medium tracking-[-0.01em] text-muted">Lingxi</span>
      ) : null}
    </span>
  );

  if (variant === "wordmark") {
    return <span className={cn("inline-flex items-center", className)}>{wordmark}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LingxiGlyph title="灵犀" className={cn("size-6 text-[#006fee]", glyphClassName)} />
      {wordmark}
    </span>
  );
}
