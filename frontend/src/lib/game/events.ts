import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Character } from "@/components/game/avatar/characters";
import type { AnswerTexts } from "@/types/quiz";
import type { PlayerQuestion, RevealPayload } from "@/types/game";

// What the server sends over the game sockets. The spec is docs/protocol.md, the source of truth
// is backend/app/game/protocol.py. Keys are camelCase.

export type ServerPhase = "lobby" | "question" | "counts" | "leaderboard" | "ended";

export type PlayerPublic = { id: string; nickname: string; character: Character };
export type ServerStanding = PlayerPublic & { score: number; rank: number };

/** The host screen also gets the four answer texts. The correct one only comes with `question.closed`. */
export type HostQuestion = PlayerQuestion & { answers: AnswerTexts };

export type PlayerEvent =
  | {
      type: "state";
      phase: ServerPhase;
      you: ServerStanding;
      players: PlayerPublic[];
      question: PlayerQuestion | null;
      remainingMs: number | null;
      answered: AnswerPosition | null;
      reveal: RevealPayload | null;
      top: ServerStanding[] | null;
    }
  | { type: "lobby.updated"; players: PlayerPublic[] }
  | { type: "question.started"; question: PlayerQuestion }
  | { type: "answer.accepted"; position: AnswerPosition }
  | { type: "question.closed"; reveal: RevealPayload; score: number; rank: number }
  | { type: "leaderboard"; top: ServerStanding[]; you: ServerStanding }
  | { type: "game.ended"; top: ServerStanding[]; you: ServerStanding }
  | { type: "kicked" }
  | { type: "replaced" }
  | { type: "game.closed" }
  | { type: "error"; code: string };

/** A player the server flagged, with the reasons. `kind` is one of the report's flag kinds. */
export type Cheater = { playerId: string; nickname: string; flags: { kind: string; count: number }[] };

export type Ruling = "kick" | "zero" | "void_last" | "mercy";

export type HostEvent =
  | {
      type: "host.state";
      gameId: string;
      pin: string;
      phase: ServerPhase;
      total: number;
      players: PlayerPublic[];
      question: HostQuestion | null;
      remainingMs: number | null;
      answered: number;
      counts: number[] | null;
      correct: AnswerPosition | null;
      standings: ServerStanding[] | null;
      cheaters: Cheater[] | null;
    }
  | { type: "lobby.updated"; players: PlayerPublic[] }
  | { type: "question.started"; question: HostQuestion }
  | { type: "answer.count"; answered: number; total: number }
  | { type: "question.closed"; counts: number[]; correct: AnswerPosition }
  | { type: "leaderboard"; standings: ServerStanding[] }
  | { type: "cheaters"; cheaters: Cheater[] }
  | { type: "game.ended"; gameId: string; standings: ServerStanding[]; cheaters: Cheater[] }
  | { type: "replaced" }
  | { type: "error"; code: string };

/** What a client may send. `v` is added by the socket. */
export type PlayerMessage =
  | { type: "answer"; position: AnswerPosition }
  | { type: "signal"; kind: "TAB_BLUR" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "PASTE" }
  | { type: "character.set"; character: Character };

export type HostMessage =
  | { type: "start" }
  /** `fromPhase`: the screen it was pressed on. The server ignores a press that is out of date. */
  | { type: "next"; fromPhase: "question" | "counts" | "leaderboard" }
  | { type: "end" }
  | { type: "kick"; playerId: string }
  /** On the podium: what to do about a suspected cheater. */
  | { type: "rule"; playerId: string; action: Ruling };
