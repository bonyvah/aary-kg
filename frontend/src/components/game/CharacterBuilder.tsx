"use client";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Shuffle } from "@phosphor-icons/react/ssr";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { Avatar } from "./Avatar";
import { COLORS, FACES, SHAPES, randomCharacter, type Character } from "./avatar/characters";
import { colorClasses } from "./avatar/colors";

const TABS = ["shape", "color", "face"] as const;
type Tab = (typeof TABS)[number];

type CharacterBuilderProps = {
  value: Character;
  onChange: (character: Character) => void;
  className?: string;
};

const optionBase = cx(
  "grid place-items-center rounded-md p-1",
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  "aria-pressed:outline-3 aria-pressed:outline-offset-2 aria-pressed:outline-focus-ring",
);

/** Preview, a shuffle button and three tabs (shape, color, face) with every option listed. */
export function CharacterBuilder({ value, onChange, className }: CharacterBuilderProps) {
  const t = useTranslations("player.character");
  const names = useTranslations("common.character");
  const [tab, setTab] = useState<Tab>("shape");
  const baseId = useId();

  function onTabKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length] as Tab;
    setTab(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  }

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <Avatar character={value} size="xl" />
        <Button variant="neutral" onClick={() => onChange(randomCharacter())}>
          <Icon icon={Shuffle} weight="bold" />
          {t("shuffle")}
        </Button>
      </div>

      <div role="tablist" aria-label={t("title")} className="flex gap-2">
        {TABS.map((id, index) => (
          <Button
            key={id}
            id={`${baseId}-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`${baseId}-panel`}
            tabIndex={tab === id ? 0 : -1}
            variant={tab === id ? "primary" : "neutral"}
            className="min-w-0 flex-1 px-2"
            onClick={() => setTab(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {t(`tab.${id}`)}
          </Button>
        ))}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab}`}
        className="grid min-h-[232px] grid-cols-4 content-start gap-2"
      >
        {tab === "shape"
          ? SHAPES.map((shape) => (
              <button
                key={shape}
                type="button"
                aria-pressed={value.shape === shape}
                aria-label={names(`shape.${shape}`)}
                onClick={() => onChange({ ...value, shape })}
                className={optionBase}
              >
                <Avatar character={{ ...value, shape }} size="lg" />
              </button>
            ))
          : null}
        {tab === "color"
          ? COLORS.map((color) => {
              const selected = value.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={selected}
                  aria-label={names(`color.${color}`)}
                  onClick={() => onChange({ ...value, color })}
                  className={optionBase}
                >
                  <span
                    className={cx(
                      "grid size-[56px] place-items-center rounded-full border-[3px]",
                      colorClasses[color].swatch,
                      colorClasses[color].face,
                    )}
                  >
                    {selected ? <Check width={28} height={28} /> : null}
                  </span>
                </button>
              );
            })
          : null}
        {tab === "face"
          ? FACES.map((face) => (
              <button
                key={face}
                type="button"
                aria-pressed={value.face === face}
                aria-label={names(`face.${face}`)}
                onClick={() => onChange({ ...value, face })}
                className={optionBase}
              >
                <Avatar character={{ ...value, face }} size="lg" />
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
