import Link from "next/link";
import { useTranslations } from "next-intl";
import { Trophy } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Td, Th } from "@/components/ui/Table";
import { finishedCount } from "@/lib/contestScoring";
import type { Contest } from "@/types/contest";
import { ContestStatusBadge } from "./ContestStatusBadge";

/** Every contest of everyone, for admins. */
export function ContestsTable({ contests }: { contests: readonly Contest[] }) {
  const t = useTranslations("admin.contests");
  const tc = useTranslations("contest");
  if (contests.length === 0) return <EmptyState icon={Trophy} title={t("empty")} />;

  return (
    <Table className="min-w-[760px]">
      <thead>
        <tr>
          <Th>{t("title")}</Th>
          <Th>{t("owner")}</Th>
          <Th>{t("status")}</Th>
          <Th className="text-right">{t("entries")}</Th>
          <Th>{t("jury")}</Th>
        </tr>
      </thead>
      <tbody>
        {contests.map((contest) => (
          <tr key={contest.id}>
            <Td className="font-bold">
              <Link
                href={`/contests/${contest.id}`}
                className="break-words underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {contest.title}
              </Link>
            </Td>
            <Td>{contest.ownerName}</Td>
            <Td>
              <ContestStatusBadge status={contest.status} />
            </Td>
            <Td className="text-right tabular-nums">{contest.entries.length}</Td>
            <Td className="whitespace-nowrap">
              {contest.status === "open"
                ? tc("progress", { finished: finishedCount(contest), total: contest.jury.length })
                : tc("juryCount", { count: contest.jury.length })}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
