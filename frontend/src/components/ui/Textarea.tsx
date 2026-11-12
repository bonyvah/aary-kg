import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  /** Keep the label for assistive tech only (the question above names the field). */
  hideLabel?: boolean;
  wrapperClassName?: string;
};

/** Several lines of text: the same look, outline and error as Input. */
export function Textarea({ label, error, hideLabel = false, wrapperClassName, id, className, ...rest }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className={cx("flex flex-col gap-2", wrapperClassName)}>
      <label htmlFor={textareaId} className={hideLabel ? "sr-only" : "text-body font-bold text-ink"}>
        {label}
      </label>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cx(
          "min-h-[120px] w-full resize-y rounded-md border-2 border-field-border bg-field px-4 py-3 text-body-lg font-medium text-on-field",
          "placeholder:text-on-field-muted",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          "aria-invalid:border-danger",
          "disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-on-disabled",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-caption font-bold text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
