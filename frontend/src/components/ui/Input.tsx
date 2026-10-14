import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  helper?: string;
  error?: string;
  pin?: boolean;
  /** Keep the label for assistive tech only (a compact field with context around it). */
  hideLabel?: boolean;
  /** Class for the wrapper, e.g. to let the field fill a flex row. */
  wrapperClassName?: string;
};

export function Input({ label, helper, error, pin = false, hideLabel = false, wrapperClassName, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helper ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-2", wrapperClassName)}>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "text-body font-bold text-ink"}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...(pin ? { inputMode: "numeric", autoComplete: "off" } : {})}
        className={cx(
          "w-full rounded-md border-2 border-field-border bg-field text-on-field",
          "placeholder:text-on-field-muted",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          "aria-invalid:border-danger",
          "disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-on-disabled",
          pin
            ? "min-h-[64px] px-4 py-3 text-center text-h1 font-black tracking-[0.12em]"
            : "min-h-12 px-4 py-3 text-body-lg font-medium",
          className,
        )}
        {...rest}
      />
      {helper ? (
        <p id={helperId} className="text-caption text-ink-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption font-bold text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
