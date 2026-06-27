import {forwardRef} from "react";
import type {ReactNode} from "react";

import {Button as HeroButton} from "@heroui/react/button";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-soft";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  block?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  /** Mapped to HeroUI's `onPress` (react-aria) so existing onClick call sites keep working. */
  onClick?: () => void;
  "aria-label"?: string;
  autoFocus?: boolean;
  children?: ReactNode;
}

/**
 * Brand button — a thin wrapper over the REAL HeroUI OSS Button (react-aria), so
 * chat-frontend and agent-frontend share the exact same primitive (D8). The
 * brand accent (#006FEE) drives the `primary` variant through the design tokens.
 * We keep the `onClick`/`disabled`/`iconOnly`/`block` prop names so call sites
 * don't change; they map to HeroUI's `onPress`/`isDisabled`/`isIconOnly`/
 * `fullWidth`. DESIGN.md's four states (hover/pressed/disabled/focus) and the
 * soft-blue focus ring come from HeroUI's button styles.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {variant = "primary", size = "md", iconOnly, block, disabled, type = "button", className, onClick, children, ...rest},
  ref,
) {
  return (
    <HeroButton
      ref={ref}
      variant={variant}
      size={size}
      isIconOnly={iconOnly}
      fullWidth={block}
      isDisabled={disabled}
      type={type}
      className={className}
      onPress={onClick}
      {...rest}
    >
      {children}
    </HeroButton>
  );
});
