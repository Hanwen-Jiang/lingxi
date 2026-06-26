// @infinitechat/design-system — public surface.
// Owned by S4 (chat-frontend), consumed by S2 (agent-frontend). See DESIGN.md + D8/D12.

// Utilities
export {cn} from "./lib/cn";

// Theme
export {ThemeProvider, useTheme} from "./theme/ThemeProvider";
export {
  applyTheme,
  persistTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "./theme/theme";

// Brand
export {LingxiGlyph, LingxiLogo} from "./brand/Logo";
export {RailIcon, RailIconSprite, type RailDestination} from "./brand/railIcons";

// Real-IM-state primitives (the prototype never had these — core value-add)
export {Skeleton, SkeletonList, SkeletonRow} from "./primitives/Skeleton";
export {EmptyState} from "./primitives/EmptyState";
export {ErrorState} from "./primitives/ErrorState";
export {ConnectionBanner, StatusDot, type ConnectionState} from "./primitives/connection";
export {DeliveryTick, StatusPill, UnreadBadge, type DeliveryState} from "./primitives/delivery";

// Brand components (wrapping real HeroUI where it adds value; native where DESIGN.md
// needs exact control). Button/Switch are backed by HeroUI OSS (react-aria).
export {Button, type ButtonProps} from "./components/Button";
export {Switch, type SwitchProps} from "./components/Switch";
export {Panel, DividerRow, SectionLabel} from "./components/Panel";
export {TextField, TextArea, type TextFieldProps, type TextAreaProps} from "./components/Field";
export {Avatar} from "./components/Avatar";

// Real HeroUI OSS scroll-shadow, re-exported so the design system is the single
// import surface. Used for scrollable lists (DESIGN.md).
export {ScrollShadow} from "@heroui/react/scroll-shadow";
