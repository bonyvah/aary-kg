"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, DotsSixVertical } from "@phosphor-icons/react/ssr";
import { IconButton } from "@/components/ui/IconButton";
import { cx } from "@/lib/cx";
import { useDragReorder } from "@/lib/useDragReorder";
import type { BaseQuestion } from "@/types/quiz";

type QuestionOrderProps = {
  questions: readonly BaseQuestion[];
  invalidIds: ReadonlySet<string>;
  onMove: (id: string, to: number) => void;
  /** Opens the question in the question editor. */
  onOpen: (id: string) => void;
};

/** The questions in order: drag a row (or use the arrows) to move it, open one to edit it. */
export function QuestionOrder({ questions, invalidIds, onMove, onOpen }: QuestionOrderProps) {
  const t = useTranslations("staff.editor");
  const drag = useDragReorder(
    questions.map((q) => q.id),
    onMove,
  );

  return (
    <ol className="flex flex-col gap-2" aria-label={t("questions")}>
      {questions.map((question, index) => (
        <li
          key={question.id}
          {...drag.row(question.id)}
          className={cx(
            "flex items-center gap-2 rounded-md bg-surface-raised px-2 py-1",
            drag.dragging === question.id && "opacity-50",
            drag.over === question.id && drag.dragging !== question.id && "outline-3 outline-accent",
            invalidIds.has(question.id) && "outline-2 outline-danger-text",
          )}
        >
          <DotsSixVertical aria-hidden="true" weight="bold" size={22} className="flex-none cursor-grab text-ink-muted" />
          <button
            type="button"
            onClick={() => onOpen(question.id)}
            {...drag.keys(question.id)}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 text-left font-bold hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span className="min-w-6 text-center text-h3 font-black tabular-nums">{index + 1}</span>
            <span className="min-w-0 truncate">{question.text || t("emptyQuestion")}</span>
          </button>
          <IconButton label={t("moveUp", { number: index + 1 })} title={t("moveUp", { number: index + 1 })} disabled={index === 0} onClick={() => onMove(question.id, index - 1)}>
            <ArrowUp weight="bold" size={20} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t("moveDown", { number: index + 1 })}
            title={t("moveDown", { number: index + 1 })}
            disabled={index === questions.length - 1}
            onClick={() => onMove(question.id, index + 1)}
          >
            <ArrowDown weight="bold" size={20} aria-hidden="true" />
          </IconButton>
        </li>
      ))}
    </ol>
  );
}
