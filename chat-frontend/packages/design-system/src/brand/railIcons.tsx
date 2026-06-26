import {cn} from "../lib/cn";

/**
 * App-rail icon system (DESIGN.md §Icons): an iconfont-ready SVG <symbol> sprite
 * using the `#ic-rail-*` id convention, referenced via <use>. Single-color
 * linear glyphs only — no emoji, no letter placeholders. When a real iconfont
 * symbol bundle arrives, swap the sprite while keeping these semantic ids.
 */
export type RailDestination =
  | "home"
  | "message"
  | "contacts"
  | "discover"
  | "assistant"
  | "settings";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Render once near the app root. Hidden; only provides the <symbol> defs. */
export function RailIconSprite() {
  return (
    <svg width={0} height={0} aria-hidden="true" style={{position: "absolute"}}>
      <defs>
        <symbol id="ic-rail-home" viewBox="0 0 24 24">
          <path d="M4 10.8 11.3 4.7a1.1 1.1 0 0 1 1.4 0L20 10.8" {...STROKE} />
          <path d="M5.8 9.3V19a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V9.3" {...STROKE} />
          <path d="M9.7 20v-4.6a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1V20" {...STROKE} />
        </symbol>
        <symbol id="ic-rail-message" viewBox="0 0 24 24">
          <path
            d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9.5L6 19.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"
            {...STROKE}
          />
        </symbol>
        <symbol id="ic-rail-contacts" viewBox="0 0 24 24">
          <circle cx="12" cy="9" r="3.3" {...STROKE} />
          <path d="M5.7 19.5a6.4 6.4 0 0 1 12.6 0" {...STROKE} />
        </symbol>
        <symbol id="ic-rail-discover" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" {...STROKE} />
          <path d="m14.8 9.2-1.7 4-4 1.6 1.7-4z" {...STROKE} />
        </symbol>
        <symbol id="ic-rail-assistant" viewBox="0 0 24 24">
          <path d="M12 4.2 13.6 9 18 10.6 13.6 12.2 12 17 10.4 12.2 6 10.6 10.4 9z" {...STROKE} />
          <circle cx="17.6" cy="17.6" r="1.5" {...STROKE} />
        </symbol>
        <symbol id="ic-rail-settings" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" {...STROKE} />
          <path
            d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"
            {...STROKE}
          />
        </symbol>
      </defs>
    </svg>
  );
}

/** A rail icon, referencing the sprite by semantic name. Size via className. */
export function RailIcon({name, className}: {name: RailDestination; className?: string}) {
  return (
    <svg className={cn("size-6", className)} aria-hidden="true">
      <use href={`#ic-rail-${name}`} />
    </svg>
  );
}
