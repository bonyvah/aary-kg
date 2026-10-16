import type { Character } from "@/components/game/avatar/characters";
import type { GameReport } from "@/types/report";
import { apiFetch } from "./client";

/** A player's side: no account. Both calls need only the PIN. */
export const checkPin = (pin: string) => apiFetch<void>(`/games/pin/${pin}`);

export type Joined = { token: string; player: { id: string; nickname: string; character: Character } };

export const joinGame = (pin: string, nickname: string) =>
  apiFetch<Joined>("/games/join", { method: "POST", body: { pin, nickname } });

/** The host's side: a signed-in staff user. */
export const createGame = (quizId: string) =>
  apiFetch<{ gameId: string; pin: string }>("/games", { method: "POST", body: { quizId } });

/** One minute, one game: the first message on the host socket. */
export const getHostTicket = (gameId: string) =>
  apiFetch<{ ticket: string }>(`/games/${gameId}/host-ticket`, { method: "POST" }).then((r) => r.ticket);

export type GameSummary = {
  id: string;
  quizTitle: string;
  /** Name of the host. Only the admin's list needs it. */
  ownerName: string;
  finishedAt: string;
  playerCount: number;
  questionCount: number;
};

export const listGames = () => apiFetch<GameSummary[]>("/games");

export const getReport = (gameId: string) => apiFetch<GameReport>(`/games/${gameId}/report`);
