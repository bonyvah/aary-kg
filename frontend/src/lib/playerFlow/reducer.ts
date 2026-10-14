import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Character } from "@/components/game/avatar/characters";
import type { ErrorCode, GamePhase, PlayerQuestion, RevealPayload } from "@/types/game";

export type FlowState = {
  phase: GamePhase;
  pin: string;
  nickname: string;
  character: Character;
  question: PlayerQuestion | null;
  secondsLeft: number;
  selected: AnswerPosition | null;
  /** Seconds left when the answer arrived: the server's clock, used for scoring. */
  answerSecondsLeft: number | null;
  reveal: RevealPayload | null;
  score: number;
  error: ErrorCode | null;
};

/** Events a real server connection would deliver, plus the player's own actions. */
export type FlowEvent =
  | { type: "PIN_ACCEPTED"; pin: string }
  | { type: "REJECTED"; error: ErrorCode }
  | { type: "NICKNAME_ACCEPTED"; nickname: string; character: Character }
  | { type: "QUESTION_STARTED"; question: PlayerQuestion }
  | { type: "TICK" }
  | { type: "ANSWER_SELECTED"; position: AnswerPosition }
  | { type: "QUESTION_CLOSED"; reveal: RevealPayload }
  | { type: "LEADERBOARD_SHOWN" }
  | { type: "GAME_ENDED" }
  | { type: "JUMPED"; phase: GamePhase }
  | { type: "RESET" };

// A fixed starting character keeps the server render and the first client render identical.
export const INITIAL_CHARACTER: Character = { shape: "circle", color: "blue", face: "smile" };

export const initialState: FlowState = {
  phase: "join",
  pin: "",
  nickname: "",
  character: INITIAL_CHARACTER,
  question: null,
  secondsLeft: 0,
  selected: null,
  answerSecondsLeft: null,
  reveal: null,
  score: 0,
  error: null,
};

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "PIN_ACCEPTED":
      return { ...state, phase: "nickname", pin: event.pin, error: null };
    case "REJECTED":
      return { ...state, error: event.error };
    case "NICKNAME_ACCEPTED":
      return { ...state, phase: "lobby", nickname: event.nickname, character: event.character, error: null };
    case "QUESTION_STARTED":
      return {
        ...state,
        phase: "question",
        question: event.question,
        secondsLeft: event.question.seconds,
        selected: null,
        answerSecondsLeft: null,
        reveal: null,
      };
    case "TICK":
      return state.phase === "question" || state.phase === "answered"
        ? { ...state, secondsLeft: Math.max(0, state.secondsLeft - 1) }
        : state;
    case "ANSWER_SELECTED":
      // The server accepts one answer per question, only while the question is open.
      return state.phase === "question" && state.selected === null
        ? { ...state, phase: "answered", selected: event.position, answerSecondsLeft: state.secondsLeft }
        : state;
    case "QUESTION_CLOSED":
      return state.phase === "question" || state.phase === "answered"
        ? { ...state, phase: "result", reveal: event.reveal, score: state.score + event.reveal.points }
        : state;
    case "LEADERBOARD_SHOWN":
      return { ...state, phase: "leaderboard" };
    case "GAME_ENDED":
      return { ...state, phase: "podium" };
    case "JUMPED":
      return { ...state, phase: event.phase, error: null };
    case "RESET":
      return initialState;
  }
}
