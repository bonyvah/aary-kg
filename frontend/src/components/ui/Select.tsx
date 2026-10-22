import { useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  /** Translated error text; also marks the select invalid. */
  error?: string;
  /** Keep the label for assistive tech only (a compact control with context around it). */
  hideLabel?: boolean;
  /** Class for the wrapper, e.g. to set a width. */
  wrapperClassName?: string;
};

/** Native select with a label, same size and outline as Input. */
export function Select({ label, error, hideLabel = false, wrapperClassName, className, id, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={cx("flex flex-col gap-2", wrapperClassName)}>
      <label htmlFor={selectId} className={hideLabel ? "sr-only" : "text-body font-bold text-ink"}>
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cx(
          "min-h-12 w-full min-w-0 rounded-md border-2 border-field-border bg-field px-3 text-body-lg font-medium text-on-field",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          "aria-invalid:border-danger",
          "disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-on-disabled",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className="text-caption font-bold text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
