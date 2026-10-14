import type { Character } from "@/components/game/avatar/characters";

/**
 * Anti-cheat signals the server logged for a player. They are hints for the host, never proof,
 * and nobody is removed from a game because of them.
 */
export type FlagKind = "TAB_BLUR" | "PASTE" | "FAST_ANSWERS" | "SAME_TIMING";

export type AntiCheatFlag = { kind: FlagKind; count: number };

export type ReportPlayer = {
  id: string;
  nickname: string;
  character: Character;
  rank: number;
  score: number;
  correct: number;
  flags: AntiCheatFlag[];
};

export type ReportQuestion = {
  id: string;
  text: string;
  /** Share of the players who answered right, 0 to 1. */
  correctShare: number;
};

export type GameReport = {
  quizId: string;
  quizTitle: string;
  /** ISO date and time the game ended. */
  finishedAt: string;
  durationSeconds: number;
  questionCount: number;
  players: ReportPlayer[];
  questions: ReportQuestion[];
};
