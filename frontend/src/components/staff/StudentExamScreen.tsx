"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { getStudentExam, startStudentExam } from "@/lib/api/studentExams";
import { enterFullscreen } from "@/lib/playerFlow/useScreenGuard";
import { useCountdown } from "@/lib/studentExam";
import type { StudentExam, StudentQuestion } from "@/types/studentExam";
import { ExamResult } from "./ExamResult";
import { ExamTakingScreen } from "./ExamTakingScreen";
import { StudentExamBadge } from "./StudentExamBadge";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

// While the attempt runs: how often to ask whether the teacher closed the exam, and how long to wait
// after the countdown ends for the server to end the attempt.
const POLL_MS = 15000;
const END_GRACE_MS = 4000;

const running = (exam: StudentExam): exam is StudentExam & { questions: StudentQuestion[] } =>
  exam.attempt?.state === "in_progress" && exam.questions !== null;

/** /student/exams/<id>: start the exam, take it, and what is left once it is handed in. */
export function StudentExamScreen({ exam: initial }: { exam: StudentExam }) {
  const t = useTranslations("student.exam");
  const tc = useTranslations("common");
  const { toast, show } = useToast();
  const [exam, setExam] = useState(initial);
  const [busy, setBusy] = useState(false);
  const inProgress = running(exam);
  const left = useCountdown(exam.attempt?.secondsLeft ?? 0, exam.attempt?.deadlineAt);

  const reload = useCallback(async () => {
    try {
      setExam(await getStudentExam(initial.id));
    } catch {
      // Offline for a moment: the next poll tries again.
    }
  }, [initial.id]);

  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [inProgress, reload]);

  useEffect(() => {
    if (!inProgress || left > 0) return;
    const timer = setTimeout(() => void reload(), END_GRACE_MS);
    return () => clearTimeout(timer);
  }, [inProgress, left, reload]);

  // Once handed in, full screen is no longer needed.
  useEffect(() => {
    if (!inProgress && typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [inProgress]);

  async function start() {
    enterFullscreen();
    setBusy(true);
    try {
      setExam(await startStudentExam(exam.id));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
      void reload();
    } finally {
      setBusy(false);
    }
  }

  if (inProgress) {
    return <ExamTakingScreen exam={exam} onEnded={(next) => (next ? setExam(next) : void reload())} />;
  }

  const canStart = exam.status === "open" && exam.attendance !== "absent" && exam.attempt === null;

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/student" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <StudentExamBadge exam={exam} />
        </div>
        <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{exam.title}</h1>
        <p className="text-body-lg text-ink-muted">{t("meta", { count: exam.questionCount, minutes: exam.minutes })}</p>
      </div>
      {canStart ? (
        <div>
          <Button variant="success" size="lg" disabled={busy} onClick={() => void start()}>
            {t("start")}
          </Button>
        </div>
      ) : null}
      {exam.result ? <ExamResult result={exam.result} /> : null}
      {toast}
    </StaffShell>
  );
}
