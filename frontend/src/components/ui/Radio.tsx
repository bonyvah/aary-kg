import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & { label: string };

/** A real radio button, the round sibling of Checkbox: flat white circle, a filled dot when picked, 44px target. */
export function Radio({ label, id, className, checked, disabled, ...rest }: RadioProps) {
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
      <input id={inputId} type="radio" checked={checked} disabled={disabled} className="peer sr-only" {...rest} />
      <span
        aria-hidden="true"
        className={cx(
          "grid size-6 flex-none place-items-center rounded-full border-2 border-field-border bg-field text-on-field",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring",
          "peer-disabled:border-disabled peer-disabled:bg-disabled peer-disabled:text-on-disabled",
        )}
      >
        {checked ? <span className="size-3 rounded-full bg-current" /> : null}
      </span>
      <span className="text-body-lg font-bold [overflow-wrap:anywhere]">{label}</span>
    </label>
  );
}
