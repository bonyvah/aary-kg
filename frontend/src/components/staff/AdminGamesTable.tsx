import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Td, Th } from "@/components/ui/Table";
import { ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import type { GameSummary } from "@/lib/api/games";

/** Every finished game of everyone, for admins. A row opens the game to read and correct. */
export function AdminGamesTable({ games }: { games: readonly GameSummary[] }) {
  const t = useTranslations("admin.games");
  const format = useFormatter();

  if (games.length === 0) {
    return <EmptyState icon={ClockCounterClockwise} title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <Table className="min-w-[760px]">
      <thead>
        <tr>
          <Th>{t("quiz")}</Th>
          <Th>{t("host")}</Th>
          <Th>{t("finished")}</Th>
          <Th className="text-right">{t("players")}</Th>
        </tr>
      </thead>
      <tbody>
        {games.map((game) => (
          <tr key={game.id}>
            <Td className="font-bold">
              <Link
                href={`/admin/games/${game.id}`}
                className="break-words underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {game.quizTitle}
              </Link>
            </Td>
            <Td>{game.ownerName}</Td>
            <Td className="whitespace-nowrap">
              {format.dateTime(new Date(game.finishedAt), { dateStyle: "medium", timeStyle: "short" })}
            </Td>
            <Td className="text-right tabular-nums">{format.number(game.playerCount)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
