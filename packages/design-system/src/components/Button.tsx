import {forwardRef} from "react";
import type {ButtonHTMLAttributes, ReactNode} from "react";
import {tv, type VariantProps} from "tailwind-variants";

/**
 * Brand button. Native element for full control over the four states DESIGN.md
 * requires (hover / pressed / disabled / keyboard focus) and ≥40px touch targets
 * on mobile. Primary = solid blue + white; secondary = neutral soft with blue
 * text/border (light) or neutral/black (dark); focus ring is a soft blue
 * outline (no off-brand glow).
 */
const button = tv({
  base: [
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium select-none",
    "transition-[background-color,border-color,color,box-shadow] duration-150",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lx-accent)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  variants: {
    variant: {
      primary:
        "bg-[var(--lx-accent)] text-white hover:bg-[var(--lx-accent-strong)] active:bg-[var(--lx-accent-strong)]",
      secondary:
        "border border-separator bg-surface text-foreground hover:bg-[color-mix(in_oklch,var(--foreground)_6%,var(--surface))] active:bg-[color-mix(in_oklch,var(--foreground)_10%,var(--surface))]",
      ghost:
        "text-foreground hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] active:bg-[color-mix(in_oklch,var(--foreground)_12%,transparent)]",
      danger:
        "bg-[var(--lx-state-error)] text-white hover:brightness-95 active:brightness-90",
    },
    size: {
      sm: "h-8 px-3 text-[0.8125rem]",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-sm",
    },
    iconOnly: {true: "aspect-square px-0", false: ""},
    block: {true: "w-full", false: ""},
  },
  defaultVariants: {variant: "primary", size: "md", iconOnly: false, block: false},
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {variant, size, iconOnly, block, className, type = "button", children, ...rest},
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={button({variant, size, iconOnly, block, className})}
      {...rest}
    >
      {children}
    </button>
  );
});
