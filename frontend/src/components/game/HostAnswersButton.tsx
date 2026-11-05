"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QuestionAnswers } from "@/components/staff/ReportAnswers";
import { ResourceView, useResource } from "@/components/staff/Resource";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { getLiveAnswers, type LiveAnswers } from "@/lib/api/games";

/** What the players answered so far, question by question: right or wrong, nothing about suspicions. */
export function HostAnswersButton({ gameId }: { gameId: string }) {
  const t = useTranslations("host.live");
  const tr = useTranslations("staff.report.answers");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
        {t("answers")}
      </Button>
      <Modal
        open={open}
        wide
        onClose={() => setOpen(false)}
        title={t("answers")}
        actions={
          <Button variant="neutral" onClick={() => setOpen(false)}>
            {tr("close")}
          </Button>
        }
      >
        {open ? <Loaded gameId={gameId} /> : null}
      </Modal>
    </>
  );
}

function Loaded({ gameId }: { gameId: string }) {
  const resource = useResource(() => getLiveAnswers(gameId));
  return (
    <ResourceView resource={resource} inline>
      {(answers) => <Questions answers={answers} />}
    </ResourceView>
  );
}

/** Opens on the question just played. */
function Questions({ answers }: { answers: LiveAnswers }) {
  const [page, setPage] = useState(answers.questions.length);
  const question = answers.questions[page - 1];
  if (!question) return null;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Pagination page={page} pages={answers.questions.length} onChange={setPage} />
      <p className="font-bold wrap-anywhere">{question.text}</p>
      <div className="max-h-[60dvh] overflow-y-auto">
        <QuestionAnswers question={question} players={answers.players} />
      </div>
    </div>
  );
}
