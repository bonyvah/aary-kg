export type HostPhase = "lobby" | "question" | "counts" | "leaderboard" | "podium";

export type HostState = {
  phase: HostPhase;
  /** The question being played, from 1. 0 in the lobby. */
  round: number;
  secondsLeft: number;
  /** Players who sent an answer to the current question. */
  answered: number;
  /** Answers per position after the question closed. */
  counts: [number, number, number, number] | null;
  /** Players in the game, fixed when it starts. */
  total: number;
};

export type HostEvent =
  | { type: "STARTED"; total: number; seconds: number }
  | { type: "TICK"; answered: number }
  | { type: "CLOSED"; counts: [number, number, number, number] }
  | { type: "LEADERBOARD_SHOWN" }
  | { type: "QUESTION_STARTED"; seconds: number }
  | { type: "GAME_ENDED" }
  | { type: "JUMPED"; state: HostState };

export const initialHostState: HostState = {
  phase: "lobby",
  round: 0,
  secondsLeft: 0,
  answered: 0,
  counts: null,
  total: 0,
};

export function hostReducer(state: HostState, event: HostEvent): HostState {
  switch (event.type) {
    case "STARTED":
      return state.phase === "lobby"
        ? { phase: "question", round: 1, secondsLeft: event.seconds, answered: 0, counts: null, total: event.total }
        : state;
    case "TICK":
      return state.phase === "question"
        ? { ...state, secondsLeft: Math.max(0, state.secondsLeft - 1), answered: event.answered }
        : state;
    case "CLOSED":
      return state.phase === "question" ? { ...state, phase: "counts", counts: event.counts } : state;
    case "LEADERBOARD_SHOWN":
      return state.phase === "counts" ? { ...state, phase: "leaderboard" } : state;
    case "QUESTION_STARTED":
      return state.phase === "leaderboard"
        ? { ...state, phase: "question", round: state.round + 1, secondsLeft: event.seconds, answered: 0, counts: null }
        : state;
    case "GAME_ENDED":
      return state.phase === "leaderboard" ? { ...state, phase: "podium" } : state;
    case "JUMPED":
      return event.state;
  }
}
