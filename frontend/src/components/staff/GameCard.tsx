import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDateTime } from "@/lib/useDateTime";
import { Card } from "@/components/ui/Card";
import type { GameSummary } from "@/lib/api/games";

/** A finished game on the dashboard. The whole card is the link to its report. */
export function GameCard({ game }: { game: GameSummary }) {
  const t = useTranslations("staff.dashboard");
  const dateTime = useDateTime();

  return (
    <Card
      className={
        "relative flex h-full min-h-[116px] flex-col gap-2 transition-[transform,box-shadow] duration-150 ease-out " +
        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <h2 title={game.quizTitle} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={`/reports/${game.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
          {game.quizTitle}
        </Link>
      </h2>
      <p className="text-body text-ink-muted">
        {dateTime(new Date(game.finishedAt))}
      </p>
      <p className="mt-auto text-body text-ink-muted">
        {t("gamePlayers", { count: game.playerCount })} · {t("questionCount", { count: game.questionCount })}
      </p>
    </Card>
  );
}
