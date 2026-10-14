import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { Check } from "@/components/icons";
import { cx } from "@/lib/cx";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  label: string;
  /** Second line in muted text, e.g. a login. */
  hint?: string;
};

/** A real checkbox with a flat white box and a check mark: 44px target, focus ring, disabled state. */
export function Checkbox({ label, hint, id, className, checked, disabled, ...rest }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cx(
        "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2",
        disabled ? "cursor-not-allowed text-on-disabled" : "cursor-pointer hover:bg-surface-raised",
        className,
      )}
    >
      <input id={inputId} type="checkbox" checked={checked} disabled={disabled} className="peer sr-only" {...rest} />
      <span
        aria-hidden="true"
        className={cx(
          "grid size-6 flex-none place-items-center rounded-sm border-2 border-field-border bg-field text-on-field",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring",
          "peer-disabled:border-disabled peer-disabled:bg-disabled peer-disabled:text-on-disabled",
        )}
      >
        {checked ? <Check width={18} height={18} /> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body-lg font-bold [overflow-wrap:anywhere]">{label}</span>
        {hint ? <span className="text-caption text-ink-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
