import {forwardRef, useId} from "react";
import type {InputHTMLAttributes, ReactNode, TextareaHTMLAttributes} from "react";

import {cn} from "../lib/cn";

const fieldBase =
  "w-full min-w-0 rounded-[var(--lx-radius-row)] border border-separator bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-[color-mix(in_oklch,var(--lx-accent)_55%,var(--separator))] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--lx-accent)_18%,transparent)] disabled:opacity-50";

function Wrapper({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label?: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      {label ? (
        <label htmlFor={htmlFor} className="block text-[0.8125rem] font-medium text-foreground">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[0.75rem] text-[var(--lx-state-error)]">{error}</p>
      ) : hint ? (
        <p className="text-[0.75rem] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
}

/** Text input with a clear blue focus boundary (DESIGN.md Inputs). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {label, hint, error, className, id, ...rest},
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Wrapper label={label} htmlFor={fieldId} hint={hint} error={error}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, className)}
        {...rest}
      />
    </Wrapper>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
}

/** Multi-line input with the same blue focus treatment. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {label, hint, error, className, id, rows = 3, ...rest},
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Wrapper label={label} htmlFor={fieldId} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, "resize-none leading-relaxed", className)}
        {...rest}
      />
    </Wrapper>
  );
});
