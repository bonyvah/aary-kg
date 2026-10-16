import type { Character } from "@/components/game/avatar/characters";

/**
 * Anti-cheat signals the server logged for a player. They are hints for the host, never proof,
 * and nobody is removed from a game because of them.
 */
export type FlagKind = "TAB_BLUR" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "PASTE" | "FAST_ANSWERS" | "SAME_TIMING" | "STEADY_TIMING";

export type AntiCheatFlag = { kind: FlagKind; count: number };

export type ReportAnswer = {
  /** Id of the question this answer belongs to. */
  question: string;
  /** 1 to 4: the answer the player chose. */
  position: number;
  ms: number;
  points: number;
  correct: boolean;
};

export type ReportPlayer = {
  id: string;
  nickname: string;
  character: Character;
  rank: number;
  score: number;
  correct: number;
  flags: AntiCheatFlag[];
  /** Only the questions this player answered. */
  answers: ReportAnswer[];
};

export type ReportQuestion = {
  id: string;
  text: string;
  answers: string[];
  /** 1 to 4: the position of the right answer. */
  correct: number;
  /** Share of the players who answered right, 0 to 1. */
  correctShare: number;
};

export type GameReport = {
  gameId: string;
  quizId: string;
  quizTitle: string;
  /** ISO date and time the game ended. */
  finishedAt: string;
  durationSeconds: number;
  questionCount: number;
  players: ReportPlayer[];
  questions: ReportQuestion[];
  /** How many times an admin corrected this game afterwards. */
  editCount: number;
};
