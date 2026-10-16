import { useHomePath } from "./SessionProvider";
import { useState, type CSSProperties } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useDateTime } from "@/lib/useDateTime";
import { Avatar } from "@/components/game/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { GameReport } from "@/types/report";
import { PlayerAnswers, QuestionAnswers } from "./ReportAnswers";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-body font-bold text-ink-muted">{label}</p>
      <p className="text-h1 font-black tabular-nums">{value}</p>
    </Card>
  );
}

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** What happened in one finished game: the numbers, every player with the signals the server logged, and every question. */
export function ReportScreen({ report }: { report: GameReport }) {
  const t = useTranslations("staff.report");
  const home = useHomePath();
  const format = useFormatter();
  const dateTime = useDateTime();
  const average = report.questions.reduce((sum, q) => sum + q.correctShare, 0) / Math.max(1, report.questions.length);
  const ta = useTranslations("staff.report.answers");
  const [selected, setSelected] = useState<{ kind: "player" | "question"; id: string } | null>(null);
  const player = selected?.kind === "player" ? report.players.find((p) => p.id === selected.id) : undefined;
  const question = selected?.kind === "question" ? report.questions.find((q) => q.id === selected.id) : undefined;
  const questionNumber = question ? report.questions.indexOf(question) + 1 : 0;
  const minutes = Math.max(1, Math.round(report.durationSeconds / 60));

  return (
    <StaffShell topRight={<StaffMenu />}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-h1 font-black wrap-anywhere">{report.quizTitle}</h1>
          <p className="text-body text-ink-muted">
            {dateTime(new Date(report.finishedAt), { long: true })}
          </p>
        </div>
        <ButtonLink href={home} variant="secondary">
          {t("toDashboard")}
        </ButtonLink>
      </div>

      {report.editCount > 0 ? (
        <p role="note" className="rounded-md bg-surface-raised px-4 py-3 text-body">
          {t("edited", { count: report.editCount })}
        </p>
      ) : null}

      <section aria-label={t("summary")} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("players")} value={format.number(report.players.length)} />
        <Stat label={t("accuracy")} value={format.number(average, { style: "percent", maximumFractionDigits: 0 })} />
        <Stat label={t("questions")} value={format.number(report.questionCount)} />
        <Stat label={t("duration")} value={t("minutes", { minutes })} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">{t("playersTitle")}</h2>
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th className="w-[64px]">{t("columns.rank")}</Th>
              <Th className="min-w-[200px]">{t("columns.player")}</Th>
              <Th className="text-right">{t("columns.score")}</Th>
              <Th>{t("columns.correct")}</Th>
              <Th>{t("columns.signals")}</Th>
            </tr>
          </thead>
          <tbody>
            {report.players.map((row) => (
              <tr key={row.id}>
                <Td className="font-black tabular-nums">{format.number(row.rank)}</Td>
                <Td>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setSelected({ kind: "player", id: row.id })}
                    className={cx("flex w-full cursor-pointer items-center gap-3 rounded-md text-left", focusRing)}
                  >
                    <Avatar character={row.character} />
                    <span className="min-w-0 wrap-break-word underline decoration-2 underline-offset-4">{row.nickname}</span>
                  </button>
                </Td>
                <Td className="text-right font-bold tabular-nums">{format.number(row.score)}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {t("correctOf", { correct: row.correct, total: report.questionCount })}
                </Td>
                <Td>
                  {row.flags.length === 0 ? (
                    <span aria-label={t("noSignals")}>—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {row.flags.map((flag) => (
                        <Badge key={flag.kind} variant="danger" className="whitespace-normal">
                          {t(`flags.${flag.kind}`, { count: flag.count })}
                        </Badge>
                      ))}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-3 pb-4">
        <h2 className="text-h2 font-bold">{t("questionsTitle")}</h2>
        <ol className="flex flex-col gap-3">
          {report.questions.map((row, index) => {
            const barVars = { "--pct": `${row.correctShare * 100}%` } as CSSProperties;
            return (
              <li key={row.id} className="rounded-md bg-surface-raised">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setSelected({ kind: "question", id: row.id })}
                  className={cx("flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 rounded-md px-4 py-3 text-left", focusRing)}
                >
                  <span className="min-w-6 text-h3 font-black tabular-nums">{index + 1}</span>
                  <span className="min-w-[200px] flex-1 wrap-anywhere">{row.text}</span>
                  <span className="flex w-full items-center gap-3 sm:w-[260px]">
                    <span className="h-4 flex-1 overflow-hidden rounded-full bg-surface">
                      <span style={barVars} className="block h-full w-(--pct) rounded-full bg-success" />
                    </span>
                    <span className="min-w-[48px] text-right text-body font-bold tabular-nums">
                      {format.number(row.correctShare, { style: "percent", maximumFractionDigits: 0 })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        wide
        title={player ? player.nickname : ta("questionTitle", { number: questionNumber })}
        actions={<Button onClick={() => setSelected(null)}>{ta("close")}</Button>}
        className="max-h-[calc(100dvh-var(--space-8))] overflow-y-auto"
      >
        {player ? <PlayerAnswers player={player} questions={report.questions} /> : null}
        {question ? <QuestionAnswers question={question} players={report.players} /> : null}
      </Modal>
    </StaffShell>
  );
}
