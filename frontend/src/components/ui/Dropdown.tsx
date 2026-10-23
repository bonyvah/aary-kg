"use client";

import { CaretDown } from "@phosphor-icons/react/ssr";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { cx } from "@/lib/cx";

export type DropdownOption = { value: number; label: string };

type CustomEntry = {
  label: string;
  min: number;
  max: number;
  /** Called with a valid whole number when the field is confirmed (Enter) or the list closes. */
  onCommit: (value: number) => void;
};

type DropdownProps = {
  label: string;
  value: number;
  options: ReadonlyArray<DropdownOption>;
  onChange: (value: number) => void;
  /** Text of the closed field; defaults to the selected option's label. */
  selectedLabel?: string;
  /** Adds a number field as the last cell of the list; `label` names it for assistive tech. */
  custom?: CustomEntry;
  /** Where the list opens. Default: below the field. */
  placement?: "down" | "up";
  /** Class for the wrapper, e.g. to set a width. */
  wrapperClassName?: string;
  /** Keep the label for assistive tech only (a compact control with context around it). */
  hideLabel?: boolean;
};

/** A listbox of chunky option buttons, with an optional number field for a value that is not listed. */
export function Dropdown({ label, value, options, onChange, selectedLabel, custom, placement = "down", wrapperClassName, hideLabel = false }: DropdownProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-list`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState(false);

  const selected = options.find((option) => option.value === value);

  function parseDraft(): number | null {
    if (!custom || !/^\d+$/.test(draft.trim())) return null;
    const parsed = Number(draft.trim());
    return parsed >= custom.min && parsed <= custom.max ? parsed : null;
  }

  /** Closes the list; a valid number left in the field is used, anything else is dropped. */
  function close({ commit, refocus }: { commit: boolean; refocus: boolean }) {
    const typed = commit ? parseDraft() : null;
    if (typed !== null) custom?.onCommit(typed);
    setOpen(false);
    setDraft("");
    setRejected(false);
    if (refocus) trigger.current?.focus();
  }

  function pick(next: number) {
    onChange(next);
    close({ commit: false, refocus: true });
  }

  // Click or tap outside the dropdown closes it like Tab or Escape do.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) {
        close({ commit: true, refocus: false });
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // close() reads the current draft, so the listener is renewed with it.
  });

  function onRootKeyDown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close({ commit: true, refocus: true });
    }
  }

  function onOptionKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (next) document.getElementById(`${baseId}-option-${next.value}`)?.focus();
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (draft.trim() === "") {
      close({ commit: false, refocus: true });
    } else if (parseDraft() === null) {
      setRejected(true);
    } else {
      close({ commit: true, refocus: true });
    }
  }

  function onRootBlur(event: React.FocusEvent) {
    if (!open) return;
    const next = event.relatedTarget;
    if (next instanceof Node && root.current?.contains(next)) return;
    // Focus moved to another control with the keyboard; a click elsewhere is handled by pointerdown.
    if (next !== null) close({ commit: true, refocus: false });
  }

  return (
    <div className={cx("flex flex-col gap-2", wrapperClassName)}>
      <span id={labelId} className={hideLabel ? "sr-only" : "text-body font-bold text-ink"}>
        {label}
      </span>
      <div ref={root} className="relative" onKeyDown={onRootKeyDown} onBlur={onRootBlur}>
        <button
          ref={trigger}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={labelId}
          onClick={() => (open ? close({ commit: true, refocus: false }) : setOpen(true))}
          className={cx(
            "flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border-2 border-field-border bg-field px-3",
            "text-left text-body-lg font-medium text-on-field",
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          )}
        >
          <span className="truncate">{selectedLabel ?? selected?.label ?? value}</span>
          <Icon icon={CaretDown} size={20} className={cx("shrink-0 transition-transform duration-150", open && "rotate-180")} />
        </button>
        {open ? (
          <div
            className={cx(
              "absolute left-0 z-20 w-full rounded-md border-2 border-border-control bg-surface-raised p-3",
              "shadow-[0_4px_0_0_var(--border-control)]",
              placement === "up" ? "bottom-full mb-3" : "top-full mt-3",
            )}
          >
            <div
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto p-1"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <Button
                    key={option.value}
                    id={`${baseId}-option-${option.value}`}
                    role="option"
                    aria-selected={isSelected}
                    variant={isSelected ? "primary" : "secondary"}
                    className="min-w-0 px-2 text-body"
                    autoFocus={isSelected}
                    onClick={() => pick(option.value)}
                    onKeyDown={(event) => onOptionKeyDown(event, index)}
                  >
                    {option.label}
                  </Button>
                );
              })}
              {custom ? (
                <input
                  aria-label={custom.label}
                  aria-invalid={rejected ? true : undefined}
                  placeholder={`${custom.min}–${custom.max}`}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={String(custom.max).length}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setRejected(false);
                  }}
                  onKeyDown={onFieldKeyDown}
                  className={cx(
                    "min-h-[44px] min-w-0 rounded-md border-2 border-field-border bg-field px-2 text-center text-body font-bold text-on-field",
                    "placeholder:font-medium placeholder:text-on-field-muted",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                    "aria-invalid:border-danger",
                  )}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
