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
};

/** ARIA tabs with arrow keys, Home and End. The selected tab is the white primary button. */
export function Tabs<T extends string>({ tabs, value, onChange, label, idBase, className }: TabsProps<T>) {
  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
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
