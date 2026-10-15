import type { GameDetail } from "@/types/adminGame";
import { apiFetch } from "./client";
import type { GameSummary } from "./games";

/** Every finished game of everyone. */
export const listAllGames = () => apiFetch<GameSummary[]>("/admin/games");

export const getGameDetail = (gameId: string) => apiFetch<GameDetail>(`/admin/games/${gameId}`);

const player = (gameId: string, playerId: string) => `/admin/games/${gameId}/players/${playerId}`;

/** Every change answers with the whole game again: totals and ranks are recomputed on the server. */
export const adjustScore = (gameId: string, playerId: string, delta: number) =>
  apiFetch<GameDetail>(`${player(gameId, playerId)}/adjust`, { method: "POST", body: { delta } });

export const setScore = (gameId: string, playerId: string, score: number) =>
  apiFetch<GameDetail>(`${player(gameId, playerId)}/score`, { method: "PUT", body: { score } });

export const editAnswer = (
  gameId: string,
  playerId: string,
  questionId: string,
  change: { correct?: boolean; points?: number },
) =>
  apiFetch<GameDetail>(`${player(gameId, playerId)}/answers/${questionId}`, { method: "PATCH", body: change });

export const renamePlayer = (gameId: string, playerId: string, nickname: string) =>
  apiFetch<GameDetail>(player(gameId, playerId), { method: "PATCH", body: { nickname } });

export const removePlayer = (gameId: string, playerId: string) =>
  apiFetch<GameDetail>(player(gameId, playerId), { method: "DELETE" });

export const clearFlag = (gameId: string, playerId: string, kind: string) =>
  apiFetch<GameDetail>(`${player(gameId, playerId)}/flags/${kind}`, { method: "DELETE" });

export const deleteGame = (gameId: string) => apiFetch<void>(`/admin/games/${gameId}`, { method: "DELETE" });
