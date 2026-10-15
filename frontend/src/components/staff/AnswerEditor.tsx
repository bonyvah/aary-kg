"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { answerPositions, type AnswerPosition } from "@/components/game/AnswerTile";
import { Check } from "@/components/icons";
import { Input } from "@/components/ui/Input";
import { cx } from "@/lib/cx";

const SHAPE_NAME = { 1: "red", 2: "blue", 3: "yellow", 4: "green" } as const;

type AnswerEditorProps = {
  position: AnswerPosition;
  value: string;
  correct: boolean;
  /** Translated error, shown under the colored block (on the page ground, where it stays readable). */
  error?: string;
  onChange: (text: string) => void;
  onMarkCorrect: () => void;
};

/** One of the four answers: the answer color and shape, a text field, and the «this one is right» mark. */
export function AnswerEditor({ position, value, correct, error, onChange, onMarkCorrect }: AnswerEditorProps) {
  const t = useTranslations("staff.editor");
  const tc = useTranslations("common.answerShape");
  const errorId = useId();
  const { Shape, tone } = answerPositions[position];
  const shapeName = tc(SHAPE_NAME[position]);

  return (
    <div className="flex flex-col gap-2">
      <div className={cx("flex items-center gap-3 rounded-md p-3 shadow-[0_6px_0_0_var(--tile-e)]", tone)}>
        <Shape className="size-10 flex-none" />
        <Input
          hideLabel
          label={t("answerLabel", { shape: shapeName })}
          value={value}
          maxLength={200}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          wrapperClassName="min-w-0 flex-1"
        />
        <button
          type="button"
          role="radio"
          aria-checked={correct}
          aria-label={t("correctOption", { shape: shapeName })}
          onClick={onMarkCorrect}
          className={cx(
            "grid size-10 flex-none place-items-center rounded-full border-[3px] border-on-tile text-tile-green-edge",
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
            "aria-checked:bg-on-tile",
          )}
        >
          {correct ? <Check width={28} height={28} /> : null}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-caption font-bold text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
