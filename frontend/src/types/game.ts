import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { AvatarId } from "@/components/game/Avatar";

/** Shape of a player in a live game. Mock data uses it now, the API will return the same. */
export type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar: AvatarId;
};

export type StaffRole = "admin" | "user" | "jury";

export type StaffUser = {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
};

/** Screens of the player flow, in the order a game goes through them. */
export type GamePhase =
  | "join"
  | "nickname"
  | "lobby"
  | "question"
  | "answered"
  | "result"
  | "leaderboard"
  | "podium";

/** Stable error codes. The frontend turns them into translated text. */
export type ErrorCode = "PIN_INVALID" | "GAME_NOT_FOUND" | "NICKNAME_INVALID" | "NICKNAME_TAKEN";

/**
 * What a player is sent when a question starts: the question text and the time.
 * Answer text and the correct answer never reach the player (answers are read on the host screen).
 */
export type PlayerQuestion = {
  index: number;
  total: number;
  text: string;
  seconds: number;
};

/** Sent only after the question closed. */
export type RevealPayload = {
  correct: AnswerPosition;
  points: number;
};

export type Standing = Player & {
  rank: number;
  isYou: boolean;
};
