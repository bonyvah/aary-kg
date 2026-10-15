import type { Character } from "@/components/game/avatar/characters";
import type { AntiCheatFlag } from "./report";

export type DetailQuestion = {
  id: string;
  text: string;
  answers: string[];
  /** 1 to 4: the position of the right answer. */
  correct: number;
};

export type DetailAnswer = {
  /** Id of the question this answer belongs to. */
  question: string;
  position: number;
  ms: number;
  points: number;
  correct: boolean;
};

export type DetailPlayer = {
  id: string;
  nickname: string;
  character: Character;
  rank: number;
  /** Points of the answers plus the admin's `adjustment`. */
  score: number;
  adjustment: number;
  correct: number;
  flags: AntiCheatFlag[];
  answers: DetailAnswer[];
};

export type EditAction =
  | "adjust_score"
  | "set_score"
  | "edit_answer"
  | "rename_player"
  | "remove_player"
  | "clear_flag";

/** One correction an admin made, from the game's audit trail. */
export type GameEdit = {
  /** ISO date and time. */
  at: string;
  adminName: string;
  action: EditAction;
  nickname: string | null;
  detail: Record<string, unknown>;
};

/** A finished game with everything an admin may correct. The host reads the report instead. */
export type GameDetail = {
  gameId: string;
  quizTitle: string;
  ownerName: string;
  finishedAt: string;
  durationSeconds: number;
  questions: DetailQuestion[];
  players: DetailPlayer[];
  edits: GameEdit[];
};
