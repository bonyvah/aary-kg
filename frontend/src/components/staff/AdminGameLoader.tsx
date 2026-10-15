"use client";

import { getGameDetail } from "@/lib/api/adminGames";
import { AdminGameScreen } from "./AdminGameScreen";
import { ResourceView, useResource } from "./Resource";

/** /admin/games/<game id>: the finished game as the server saved it, open for corrections. */
export function AdminGameLoader({ id }: { id: string }) {
  const resource = useResource(() => getGameDetail(id));
  return <ResourceView resource={resource}>{(game) => <AdminGameScreen game={game} />}</ResourceView>;
}
