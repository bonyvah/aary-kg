"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import type { BaseQuestion } from "@/types/quiz";

type QuestionListProps = {
  questions: readonly BaseQuestion[];
  selectedId: string;
  /** Ids of the questions with a field that failed the last save. */
  invalidIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onAdd: () => void;
};

/** Numbered list of the questions, with «add question» at the bottom. */
export function QuestionList({ questions, selectedId, invalidIds, onSelect, onAdd }: QuestionListProps) {
  const t = useTranslations("staff.editor");

  return (
    <nav aria-label={t("questions")} className="flex flex-col gap-3 bg-surface-raised p-3 md:min-h-full">
      <ol className="flex max-h-[220px] flex-col gap-2 overflow-y-auto md:max-h-none md:flex-1">
        {questions.map((question, index) => {
          const selected = question.id === selectedId;
          return (
            <li key={question.id}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(question.id)}
                className={cx(
                  "flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-left text-body font-bold",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                  selected ? "bg-field text-on-field" : "bg-surface text-ink",
                  invalidIds.has(question.id) && "outline-2 outline-danger-text",
                )}
              >
                <span className="min-w-6 text-center text-h3 font-black tabular-nums">{index + 1}</span>
                <span className="min-w-0 truncate">{question.text || t("emptyQuestion")}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Button variant="secondary" block onClick={onAdd}>
        {t("addQuestion")}
      </Button>
    </nav>
  );
}
