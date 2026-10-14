"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import { entryBreakdown } from "@/lib/contestScoring";
import type { Contest, Entry, RankedEntry } from "@/types/contest";

type BreakdownModalProps = {
  contest: Contest;
  /** The entry to explain, or null when the modal is closed. */
  ranked: RankedEntry | null;
  onClose: () => void;
};

/** Every finished jury member's scores for one entry, and the average. Owner and admins only. */
export function BreakdownModal({ contest, ranked, onClose }: BreakdownModalProps) {
  const t = useTranslations("contest.results");
  const format = useFormatter();
  const entry: Entry | undefined = ranked?.entry;
  const rows = entry ? entryBreakdown(contest, entry.id) : [];
  const two = (value: number) => format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Modal
      open={ranked !== null}
      onClose={onClose}
      wide
      title={t("breakdownTitle", { name: entry?.name ?? "" })}
      actions={<Button onClick={onClose}>{t("close")}</Button>}
    >
      <Table className="min-w-[520px]">
        <thead>
          <tr>
            <Th>{t("juryMember")}</Th>
            {contest.criteria.map((criterion) => (
              <Th key={criterion.id} className="text-right">
                {criterion.name}
                <span className="block text-caption font-medium">{t("weightValue", { weight: criterion.weight })}</span>
              </Th>
            ))}
            <Th className="text-right">{t("total")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId}>
              <Td className="font-bold">{row.name}</Td>
              {contest.criteria.map((criterion) => (
                <Td key={criterion.id} className="text-right tabular-nums">
                  {row.scores[criterion.id] ?? "—"}
                </Td>
              ))}
              <Td className="text-right font-bold tabular-nums">{row.total === null ? "—" : two(row.total)}</Td>
            </tr>
          ))}
          <tr>
            <Td className="font-black">{t("average")}</Td>
            {contest.criteria.map((criterion) => (
              <Td key={criterion.id} className="text-right font-bold tabular-nums">
                {ranked?.perCriterion[criterion.id] == null ? "—" : two(ranked.perCriterion[criterion.id] as number)}
              </Td>
            ))}
            <Td className="text-right font-black tabular-nums">{ranked?.finalScore == null ? "—" : two(ranked.finalScore)}</Td>
          </tr>
        </tbody>
      </Table>
    </Modal>
  );
}
