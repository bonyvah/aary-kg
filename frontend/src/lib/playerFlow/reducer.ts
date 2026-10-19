import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Character } from "@/components/game/avatar/characters";
import type { PlayerEvent, ServerPhase, ServerStanding } from "@/lib/game/events";
import type { ErrorCode, GamePhase, PlayerQuestion, RevealPayload, Standing } from "@/types/game";

export type FlowState = {
  phase: GamePhase;
  pin: string;
  /** This player's id in the game: tells their own row apart on the leaderboard. */
  playerId: string;
  nickname: string;
  character: Character;
  question: PlayerQuestion | null;
  secondsLeft: number;
  selected: AnswerPosition | null;
  reveal: RevealPayload | null;
  score: number;
  /** The leaderboard or podium rows the server sent, with this player's own row marked. */
  standings: Standing[];
  /** The leaderboard before the latest one, so its rows can move from their old places. */
  previousStandings: Standing[];
  error: ErrorCode | null;
};

/** Events the server connection delivers, plus the player's own actions. */
export type FlowEvent =
  | { type: "PIN_ACCEPTED"; pin: string }
  | { type: "REJECTED"; error: ErrorCode }
  | { type: "JOINED"; playerId: string; nickname: string; character: Character }
  | { type: "SERVER"; event: PlayerEvent }
  /** The game ended for this player (kicked, closed, connection lost): back to the start with a reason. */
  | { type: "LEFT"; reason: ErrorCode }
  | { type: "CHARACTER_OPENED" }
  | { type: "CHARACTER_CHANGED"; character: Character }
  | { type: "CHARACTER_CLOSED" }
  | { type: "TICK" }
  | { type: "ANSWER_SELECTED"; position: AnswerPosition }
  | { type: "RESET" };

// A fixed starting character keeps the server render and the first client render identical.
export const INITIAL_CHARACTER: Character = { shape: "circle", color: "blue", face: "smile" };

export const initialState: FlowState = {
  phase: "join",
  pin: "",
  playerId: "",
  nickname: "",
  character: INITIAL_CHARACTER,
  question: null,
  secondsLeft: 0,
  selected: null,
  reveal: null,
  score: 0,
  standings: [],
  previousStandings: [],
  error: null,
};

/** The rows of a leaderboard: the best ones, then this player if they are not among them. */
export function toStandings(top: readonly ServerStanding[], you: ServerStanding): Standing[] {
  const rows = top.map((row) => ({ ...row, isYou: row.id === you.id }));
  return rows.some((row) => row.isYou) ? rows : [...rows, { ...you, isYou: true }];
}

const PHASE: Record<ServerPhase, GamePhase> = {
  lobby: "lobby",
  question: "question",
  counts: "result",
  leaderboard: "leaderboard",
  ended: "podium",
};

function applyServerEvent(state: FlowState, event: PlayerEvent): FlowState {
  switch (event.type) {
    case "state": {
      // Sent after hello, so also after every reconnect: set everything from the server's picture.
      const phase: GamePhase =
        event.phase === "question" && event.answered !== null
          ? "answered"
          : event.phase === "lobby" && (state.phase === "character" || state.phase === "lobby")
            ? state.phase // the character builder stays open across a reconnect
            : PHASE[event.phase];
      return {
        ...state,
        phase,
        playerId: event.you.id,
        nickname: event.you.nickname,
        character: event.you.character,
        score: event.you.score,
        question: event.question,
        secondsLeft: event.remainingMs === null ? (event.question?.seconds ?? 0) : Math.ceil(event.remainingMs / 1000),
        selected: event.answered,
        reveal: event.reveal,
        standings: event.top ? toStandings(event.top, event.you) : [],
        previousStandings: [],
        error: null,
      };
    }
    case "question.started":
      return {
        ...state,
        phase: "question",
        question: event.question,
        secondsLeft: event.question.seconds,
        selected: null,
        reveal: null,
      };
    case "question.closed":
      return state.phase === "question" || state.phase === "answered"
        ? { ...state, phase: "result", reveal: event.reveal, score: event.score }
        : state;
    case "leaderboard":
      return {
        ...state,
        phase: "leaderboard",
        score: event.you.score,
        standings: toStandings(event.top, event.you),
        previousStandings: state.standings,
      };
    case "game.ended":
      return { ...state, phase: "podium", score: event.you.score, standings: toStandings(event.top, event.you) };
    // The lobby list of other players is not shown on the player screens; the character edits
    // come back through `state`, and a taken answer is already shown, so these change nothing.
    case "lobby.updated":
    case "answer.accepted":
    case "error":
    case "kicked":
    case "replaced":
    case "game.closed":
    case "game.next": // the hook connects to the next game, whose `state` sets everything
      return state;
  }
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "PIN_ACCEPTED":
      return { ...state, phase: "nickname", pin: event.pin, error: null };
    case "REJECTED":
      return { ...state, error: event.error };
    case "JOINED":
      return {
        ...state,
        phase: "lobby",
        playerId: event.playerId,
        nickname: event.nickname,
        character: event.character,
        error: null,
      };
    case "SERVER":
      return applyServerEvent(state, event.event);
    case "LEFT":
      return { ...initialState, error: event.reason };
    // The player may open the builder from the lobby and change the character until the game starts.
    case "CHARACTER_OPENED":
      return state.phase === "lobby" ? { ...state, phase: "character" } : state;
    case "CHARACTER_CHANGED":
      return state.phase === "lobby" || state.phase === "character"
        ? { ...state, character: event.character }
        : state;
    case "CHARACTER_CLOSED":
      return state.phase === "character" ? { ...state, phase: "lobby" } : state;
    case "TICK":
      // Only draws the clock. The server decides when the question is over.
      return state.phase === "question" || state.phase === "answered"
        ? { ...state, secondsLeft: Math.max(0, state.secondsLeft - 1) }
        : state;
    case "ANSWER_SELECTED":
      // The server accepts one answer per question, only while the question is open.
      return state.phase === "question" && state.selected === null
        ? { ...state, phase: "answered", selected: event.position }
        : state;
    case "RESET":
      return initialState;
  }
}
