"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Table, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/ui/useToast";
import { canManage, canScore, contestRole, scoredEntryCount, validateContest } from "@/lib/contestScoring";
import { mockCurrentUser } from "@/mocks/staff";
import type { Contest, ContestStatus } from "@/types/contest";
import { ConfirmModal } from "./ConfirmModal";
import { ContestStatusBadge } from "./ContestStatusBadge";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type Pending = "open" | "close" | null;

/** One contest: its state, what the viewer can do with it, its jury, entries and criteria. */
export function ContestScreen({ contest: initial }: { contest: Contest }) {
  const t = useTranslations("contest.page");
  const tc = useTranslations("contest");
  const { toast, show } = useToast();
  // The status is local in the mock: opening and closing only change this screen.
  const [status, setStatus] = useState<ContestStatus>(initial.status);
  const [pending, setPending] = useState<Pending>(null);

  const contest: Contest = { ...initial, status };
  const viewer = mockCurrentUser;
  const manage = canManage(contest, viewer);
  const role = contestRole(contest, viewer.id);
  const scoring = canScore(contest, viewer.id);
  const problems = validateContest(contest);

  function confirm() {
    if (pending === "open") {
      setStatus("open");
      show("success", t("toast.opened"));
    } else if (pending === "close") {
      setStatus("closed");
      show("success", t("toast.closed"));
    }
    setPending(null);
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/dashboard" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <ContestStatusBadge status={status} />
            {role ? <Badge>{tc(`role.${role}`)}</Badge> : null}
          </div>
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{contest.title}</h1>
          {contest.description ? <p className="text-body-lg text-ink-muted">{contest.description}</p> : null}
          <p className="text-body text-ink-muted">{t("organizer", { name: contest.ownerName })}</p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-3">
            {scoring ? (
              <ButtonLink href={`/contests/${contest.id}/score`} variant="accent">
                {t("actions.score")}
              </ButtonLink>
            ) : null}
            {status === "closed" ? (
              <ButtonLink href={`/contests/${contest.id}/results`} variant="accent">
                {t("actions.results")}
              </ButtonLink>
            ) : null}
            {manage && status === "draft" ? (
              <Button variant="accent" disabled={problems.length > 0} aria-describedby="open-reason" onClick={() => setPending("open")}>
                {t("actions.open")}
              </Button>
            ) : null}
            {manage && status === "open" ? (
              <Button variant="danger" onClick={() => setPending("close")}>
                {t("actions.close")}
              </Button>
            ) : null}
          </div>
          {manage && status === "draft" && problems.length > 0 ? (
            <p id="open-reason" className="max-w-[320px] text-caption text-ink-muted sm:text-right">
              {t("cannotOpen")}
            </p>
          ) : null}
        </div>
      </div>

      {scoring ? (
        <p className="rounded-md bg-surface-raised px-4 py-3 text-body-lg font-bold">
          {t("yourProgress", { scored: scoredEntryCount(contest, viewer.id), total: contest.entries.length })}
        </p>
      ) : null}
      {status !== "draft" ? <p className="text-body text-ink-muted">{t("locked")}</p> : null}

      {manage ? (
        <section className="flex flex-col gap-3" aria-labelledby="jury-title">
          <h2 id="jury-title" className="text-h2 font-bold">
            {t("juryTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {contest.jury.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-raised px-4 py-3">
                <span className="font-bold [overflow-wrap:anywhere]">{member.name}</span>
                {status === "draft" ? null : (
                  <Badge variant={member.finished ? "success" : "neutral"}>
                    {t(member.finished ? "finished" : "notFinished")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="entries-title">
        <h2 id="entries-title" className="text-h2 font-bold">
          {t("entriesTitle")}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {contest.entries.map((entry, index) => (
            <li key={entry.id} className="flex gap-3 rounded-md bg-surface-raised px-4 py-3">
              <span className="min-w-6 text-h3 font-black tabular-nums">{index + 1}</span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold [overflow-wrap:anywhere]">{entry.name}</span>
                <span className="text-body text-ink-muted [overflow-wrap:anywhere]">{entry.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 pb-4" aria-labelledby="criteria-title">
        <h2 id="criteria-title" className="text-h2 font-bold">
          {t("criteriaTitle")}
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>{t("criterion")}</Th>
              <Th className="text-right">{t("weight")}</Th>
            </tr>
          </thead>
          <tbody>
            {contest.criteria.map((criterion) => (
              <tr key={criterion.id}>
                <Td className="font-bold">{criterion.name}</Td>
                <Td className="text-right tabular-nums">{t("weightValue", { weight: criterion.weight })}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <ConfirmModal
        open={pending !== null}
        title={t(pending === "close" ? "confirmClose.title" : "confirmOpen.title")}
        body={t(pending === "close" ? "confirmClose.body" : "confirmOpen.body")}
        confirmLabel={t(pending === "close" ? "confirmClose.confirm" : "confirmOpen.confirm")}
        cancelLabel={t("cancel")}
        variant={pending === "close" ? "danger" : "primary"}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
      {toast}
    </StaffShell>
  );
}
