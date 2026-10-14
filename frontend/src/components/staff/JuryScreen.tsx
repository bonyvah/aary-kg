"use client";

import { useEffect, useReducer } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { useToast } from "@/components/ui/useToast";
import { cx } from "@/lib/cx";
import {
  canFinish,
  completeCount,
  initialJuryState,
  isEntryComplete,
  juryReducer,
  runningScore,
  type JuryEvent,
} from "@/lib/juryScoring/reducer";
import { mockCurrentUser } from "@/mocks/staff";
import type { Contest } from "@/types/contest";
import { ScoreButtons } from "./ScoreButtons";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

/** A jury member scores the entries of an open contest, one entry at a time. */
export function JuryScreen({ contest }: { contest: Contest }) {
  const t = useTranslations("contest.score");
  const format = useFormatter();
  const { toast, show } = useToast();
  const userId = mockCurrentUser.id;
  const member = contest.jury.find((item) => item.userId === userId);
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof initialJuryState>, event: JuryEvent) => juryReducer(contest, current, event),
    undefined,
    () => initialJuryState(contest.scores[userId], member?.finished ?? false),
  );

  const entry = contest.entries[state.index];
  const done = completeCount(contest, state);
  const total = contest.entries.length;
  const remaining = total - done;

  // Tell the jury member when they finish, once.
  useEffect(() => {
    if (state.finished && !member?.finished) show("success", t("finishedToast"));
  }, [state.finished, member?.finished, show, t]);

  if (!entry) return null;
  const score = runningScore(contest, state, entry.id);

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href={`/contests/${contest.id}`} variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu name={mockCurrentUser.name} />
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-h2 font-bold [overflow-wrap:anywhere]">{contest.title}</h1>
        <Badge variant={state.finished ? "success" : "accent"}>{t("progress", { scored: done, total })}</Badge>
      </div>

      <nav aria-label={t("entries")}>
        <ol className="flex gap-2 overflow-x-auto pb-2">
          {contest.entries.map((item, index) => {
            const complete = isEntryComplete(contest, state, item.id);
            const current = index === state.index;
            return (
              <li key={item.id} className="flex-none">
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => dispatch({ type: "GO_TO", index })}
                  className={cx(
                    "flex min-h-[44px] items-center gap-2 rounded-md px-4 py-2 text-body font-bold",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                    current ? "bg-field text-on-field" : "bg-surface-raised text-ink",
                  )}
                >
                  <span className="tabular-nums">{index + 1}</span>
                  {complete ? (
                    <>
                      <Check width={18} height={18} />
                      <span className="sr-only">{t("entryDone")}</span>
                    </>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="entry-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-body font-bold text-ink-muted">{t("entryOf", { current: state.index + 1, total })}</p>
          <h2 id="entry-title" className="text-h1 font-black [overflow-wrap:anywhere]">
            {entry.name}
          </h2>
          <p className="text-body-lg text-ink-muted [overflow-wrap:anywhere]">{entry.description}</p>
        </div>

        <p className="text-body text-ink-muted">{t("scaleHint")}</p>

        <ul className="flex flex-col gap-5">
          {contest.criteria.map((criterion) => (
            <li key={criterion.id} className="flex flex-col gap-2">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-h3 font-bold [overflow-wrap:anywhere]">{criterion.name}</span>
                <span className="text-body font-bold text-ink-muted">{t("weight", { weight: criterion.weight })}</span>
              </p>
              <ScoreButtons
                label={t("criterionLabel", { name: criterion.name, weight: criterion.weight })}
                value={state.scores[entry.id]?.[criterion.id]}
                onChange={(next) => dispatch({ type: "SCORE_SET", entryId: entry.id, criterionId: criterion.id, score: next })}
              />
            </li>
          ))}
        </ul>

        <p aria-live="polite" className="rounded-md bg-surface-raised px-4 py-3 text-body-lg font-bold">
          {score === null ? (
            <span className="text-ink-muted">{t("yourScoreEmpty")}</span>
          ) : (
            t("yourScore", { score: format.number(score, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
          )}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <Button variant="neutral" disabled={state.index === 0} onClick={() => dispatch({ type: "GO_TO", index: state.index - 1 })}>
          {t("previous")}
        </Button>
        <Button variant="neutral" disabled={state.index === total - 1} onClick={() => dispatch({ type: "GO_TO", index: state.index + 1 })}>
          {t("next")}
        </Button>
      </div>

      <div className="flex flex-col items-start gap-2 pb-6">
        <Button
          variant="success"
          size="lg"
          block
          disabled={!canFinish(contest, state) || state.finished}
          aria-describedby="finish-note"
          onClick={() => dispatch({ type: "FINISHED" })}
        >
          {t("finish")}
        </Button>
        <p id="finish-note" className="text-body text-ink-muted">
          {state.finished ? t("finishedNote") : remaining > 0 ? t("finishReason", { count: remaining }) : null}
        </p>
      </div>
      {toast}
    </StaffShell>
  );
}
