"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { SearchInput } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { getQuiz, listQuizzes } from "@/lib/api/quizzes";
import { matches } from "@/lib/search";
import type { Quiz } from "@/types/quiz";
import { ResourceView, useResource } from "./Resource";

type ImportFromQuizModalProps = {
  /** How many questions the exam can still take. */
  room: number;
  onImport: (quiz: Quiz, picked: Quiz["questions"]) => void;
  onClose: () => void;
};

/** Pick one of your quizzes, then all or some of its questions: they are copied into the exam. */
export function ImportFromQuizModal({ room, onImport, onClose }: ImportFromQuizModalProps) {
  const t = useTranslations("staff.examEditor.fromQuiz");
  const [quizId, setQuizId] = useState<string | null>(null);

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={t("title")}
      // The lists scroll inside; the dialog itself never does.
      className="overflow-y-hidden"
      actions={
        quizId ? null : (
          <Button variant="neutral" onClick={onClose}>
            {t("cancel")}
          </Button>
        )
      }
    >
      {quizId ? (
        <QuestionPicker quizId={quizId} room={room} onBack={() => setQuizId(null)} onImport={onImport} />
      ) : (
        <QuizPicker onPick={setQuizId} />
      )}
    </Modal>
  );
}

function QuizPicker({ onPick }: { onPick: (id: string) => void }) {
  const t = useTranslations("staff.examEditor.fromQuiz");
  const locale = useLocale();
  const quizzes = useResource(listQuizzes);
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <SearchInput label={t("search")} placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResourceView resource={quizzes} inline>
        {(all) => {
          const items = all.filter((quiz) => matches(quiz.title, query, locale));
          return items.length > 0 ? (
            <ul className="flex max-h-[min(420px,calc(100dvh-20rem))] min-h-[120px] flex-col gap-2 overflow-y-auto">
              {items.map((quiz) => (
                <li key={quiz.id}>
                  <button
                    type="button"
                    onClick={() => onPick(quiz.id)}
                    className="flex min-h-[44px] w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md bg-surface-raised px-4 py-3 text-left hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <span className="font-bold [overflow-wrap:anywhere]">{quiz.title}</span>
                    <span className="text-body text-ink-muted">{t("questionCount", { count: quiz.questionCount })}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-lg text-ink-muted">{t(all.length > 0 ? "nothingFound" : "noQuizzes")}</p>
          );
        }}
      </ResourceView>
    </div>
  );
}

function QuestionPicker({
  quizId,
  room,
  onBack,
  onImport,
}: { quizId: string } & Pick<ImportFromQuizModalProps, "room" | "onImport"> & { onBack: () => void }) {
  const resource = useResource(() => getQuiz(quizId));
  return (
    <ResourceView resource={resource} inline>
      {(quiz) => <QuestionList quiz={quiz} room={room} onBack={onBack} onImport={onImport} />}
    </ResourceView>
  );
}

function QuestionList({
  quiz,
  room,
  onBack,
  onImport,
}: { quiz: Quiz } & Pick<ImportFromQuizModalProps, "room" | "onImport"> & { onBack: () => void }) {
  const t = useTranslations("staff.examEditor.fromQuiz");
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(quiz.questions.map((q) => q.id)));
  const all = picked.size === quiz.questions.length;
  const tooMany = picked.size > room;

  function flip(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-h3 font-bold [overflow-wrap:anywhere]">{quiz.title}</p>
      <Checkbox
        label={t("all")}
        checked={all}
        onChange={() => setPicked(all ? new Set() : new Set(quiz.questions.map((q) => q.id)))}
      />
      <ol className="flex max-h-[min(380px,calc(100dvh-24rem))] min-h-[120px] flex-col gap-1 overflow-y-auto">
        {quiz.questions.map((question, index) => (
          <li key={question.id}>
            <Checkbox
              label={`${index + 1}. ${question.text}`}
              checked={picked.has(question.id)}
              onChange={() => flip(question.id)}
            />
          </li>
        ))}
      </ol>
      {tooMany ? (
        <p role="alert" className="text-caption font-bold text-danger-text">
          {t("tooMany", { room })}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="neutral" onClick={onBack}>
          {t("back")}
        </Button>
        <Button
          variant="success"
          disabled={picked.size === 0 || tooMany}
          onClick={() => onImport(quiz, quiz.questions.filter((q) => picked.has(q.id)))}
        >
          {t("import", { count: picked.size })}
        </Button>
      </div>
    </div>
  );
}
