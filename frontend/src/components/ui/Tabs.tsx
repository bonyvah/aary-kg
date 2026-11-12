"use client";

import type { KeyboardEvent } from "react";
import { Button } from "./Button";
import { cx } from "@/lib/cx";

export type TabItem<T extends string> = { id: T; label: string };

export const tabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
export const panelId = (idBase: string) => `${idBase}-panel`;

type TabsProps<T extends string> = {
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Translated name of the tab list. */
  label: string;
  /** Unique base for the ids; the panel uses `panelId(idBase)` and `aria-labelledby={tabId(idBase, value)}`. */
  idBase: string;
  className?: string;
  /** `side` is a vertical list on a wide screen (many tabs, never wraps) and a scrolling row on a phone. */
  layout?: "row" | "side";
};

/** ARIA tabs with arrow keys, Home and End. The selected tab is the white primary button. */
export function Tabs<T extends string>({ tabs, value, onChange, label, idBase, className, layout = "row" }: TabsProps<T>) {
  const side = layout === "side";
  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight" || (side && event.key === "ArrowDown")
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft" || (side && event.key === "ArrowUp")
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const next = tabs[target];
    if (!next) return;
    onChange(next.id);
    document.getElementById(tabId(idBase, next.id))?.focus();
  }

  if (side) {
    return (
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        className={cx("flex gap-3 overflow-x-auto p-1 pb-2 md:flex-col md:overflow-visible", className)}
      >
        {tabs.map((tab, index) => {
          const selected = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              id={tabId(idBase, tab.id)}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(idBase)}
              tabIndex={selected ? 0 : -1}
              className={cx(
                "min-h-[44px] shrink-0 cursor-pointer rounded-md px-4 py-2 text-left text-body-lg font-bold",
                "transition-[transform,box-shadow,background-color] duration-150 ease-out",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                selected
                  ? "bg-accent text-on-accent shadow-edge-accent [--edge-c:var(--accent-edge)]"
                  : "bg-neutral text-on-neutral shadow-edge-neutral [--edge-c:var(--neutral-edge)] hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--edge-c)] active:translate-y-1 active:shadow-[0_0_0_0_var(--edge-c)]",
              )}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={label} className={cx("flex flex-wrap gap-2", className)}>
      {tabs.map((tab, index) => (
        <Button
          key={tab.id}
          id={tabId(idBase, tab.id)}
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={panelId(idBase)}
          tabIndex={value === tab.id ? 0 : -1}
          variant={value === tab.id ? "primary" : "neutral"}
          className="flex-auto px-3 text-body"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
