"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Table, Td, Th } from "@/components/ui/Table";
import { canManage, rankEntries } from "@/lib/contestScoring";
import { mockCurrentUser } from "@/mocks/staff";
import type { Contest, RankedEntry } from "@/types/contest";
import { BreakdownModal } from "./BreakdownModal";
import { ContestStatusBadge } from "./ContestStatusBadge";
import { ResultsPodium } from "./ResultsPodium";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

/** The final ranking of a closed contest: the podium, the table, and the breakdown for those who may see it. */
export function ResultsScreen({ contest }: { contest: Contest }) {
  const t = useTranslations("contest.results");
  const format = useFormatter();
  const [explained, setExplained] = useState<RankedEntry | null>(null);
  const ranking = rankEntries(contest);
  const top = ranking.filter((item) => item.rank !== null).slice(0, 3);
  const mayExplain = canManage(contest, mockCurrentUser);
  const two = (value: number) => format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <ContestStatusBadge status={contest.status} />
        </div>
        <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{contest.title}</h1>
        <p className="text-body text-ink-muted">{t("scoreNote")}</p>
      </div>

      <ResultsPodium top={top} formatScore={two} />

      <Table className="min-w-[720px]">
        <thead>
          <tr>
            <Th className="w-[96px]">{t("rank")}</Th>
            <Th>{t("entry")}</Th>
            <Th className="text-right">{t("score")}</Th>
            {contest.criteria.map((criterion) => (
              <Th key={criterion.id} className="text-right">
                {criterion.name}
                <span className="block text-caption font-medium">{t("weightValue", { weight: criterion.weight })}</span>
              </Th>
            ))}
            {mayExplain ? <Th>{t("details")}</Th> : null}
          </tr>
        </thead>
        <tbody>
          {ranking.map((item) => (
            <tr key={item.entry.id}>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-h3 font-black tabular-nums">{item.rank === null ? "—" : format.number(item.rank)}</span>
                  {item.shared ? <Badge variant="accent">{t("shared")}</Badge> : null}
                </span>
              </Td>
              <Td>
                <span className="flex flex-col">
                  <span className="font-bold [overflow-wrap:anywhere]">{item.entry.name}</span>
                  <span className="text-caption text-ink-muted [overflow-wrap:anywhere]">{item.entry.description}</span>
                </span>
              </Td>
              <Td className="text-right text-body-lg font-black tabular-nums">{item.finalScore === null ? "—" : two(item.finalScore)}</Td>
              {contest.criteria.map((criterion) => {
                const value = item.perCriterion[criterion.id];
                return (
                  <Td key={criterion.id} className="text-right tabular-nums">
                    {value === null || value === undefined ? "—" : two(value)}
                  </Td>
                );
              })}
              {mayExplain ? (
                <Td>
                  <Button variant="neutral" onClick={() => setExplained(item)}>
                    {t("breakdown")}
                  </Button>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>

      <p className="pb-4 text-body text-ink-muted">{t("juryCount", { count: contest.jury.filter((member) => member.finished).length })}</p>

      <BreakdownModal contest={contest} ranked={explained} onClose={() => setExplained(null)} />
    </StaffShell>
  );
}
