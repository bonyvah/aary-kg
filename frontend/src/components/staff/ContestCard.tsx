import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { contestRole, finishedCount } from "@/lib/contestScoring";
import type { Contest } from "@/types/contest";
import { ContestStatusBadge } from "./ContestStatusBadge";

type ContestCardProps = {
  contest: Contest;
  /** The signed-in user, to show whether they own it or judge it. */
  userId: string;
};

/** The title is the link and its hit area covers the card, as on the quiz card. */
export function ContestCard({ contest, userId }: ContestCardProps) {
  const t = useTranslations("contest");
  const role = contestRole(contest, userId);

  return (
    <Card
      className={
        "relative flex min-h-[148px] flex-col gap-2 transition-[transform,box-shadow] duration-150 ease-out " +
        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <div className="flex flex-wrap gap-2">
        <ContestStatusBadge status={contest.status} />
        {role ? <Badge>{t(`role.${role}`)}</Badge> : null}
      </div>
      <h2 className="text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={`/contests/${contest.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
          {contest.title}
        </Link>
      </h2>
      <p className="mt-auto text-body text-ink-muted">
        {t("summary", { entries: contest.entries.length, jury: contest.jury.length })}
      </p>
      {contest.status === "open" ? (
        <p className="text-body font-bold">
          {t("progress", { finished: finishedCount(contest), total: contest.jury.length })}
        </p>
      ) : null}
    </Card>
  );
}
