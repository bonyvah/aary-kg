"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ResourceView, useResource } from "@/components/staff/Resource";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { listQuizzes } from "@/lib/api/quizzes";

type NextGameModalProps = {
  open: boolean;
  onClose: () => void;
  onPick: (quizId: string) => Promise<void>;
};

/** The host's quizzes, to play one next with the same players. */
export function NextGameModal({ open, onClose, onPick }: NextGameModalProps) {
  const t = useTranslations("host.live");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("nextGame")}
      actions={
        <Button variant="neutral" onClick={onClose}>
          {t("cancel")}
        </Button>
      }
    >
      {open ? <QuizList onPick={onPick} /> : null}
    </Modal>
  );
}

function QuizList({ onPick }: { onPick: (quizId: string) => Promise<void> }) {
  const t = useTranslations("staff.dashboard");
  const resource = useResource(listQuizzes);
  const [busy, setBusy] = useState(false);

  async function pick(quizId: string) {
    setBusy(true);
    try {
      await onPick(quizId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResourceView resource={resource} inline>
      {(quizzes) => (
        <ul className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto pt-2 pb-2">
          {quizzes.map((quiz) => (
            <li key={quiz.id}>
              <Button variant="neutral" block disabled={busy} onClick={() => void pick(quiz.id)}>
                <span className="flex w-full items-center justify-between gap-4 text-left">
                  <span title={quiz.title} className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">
                    {quiz.title}
                  </span>
                  <span className="shrink-0 text-body font-medium text-ink-muted">
                    {t("questionCount", { count: quiz.questionCount })}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ResourceView>
  );
}
