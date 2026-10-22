import type { AnswerPosition } from "@/components/game/AnswerTile";
import { questionClock, tickClock } from "@/lib/game/clock";
import type { Cheater, GameSettings, HostEvent, HostQuestion, PlayerPublic, ServerPhase, ServerStanding } from "@/lib/game/events";
import type { Player, Standing } from "@/types/game";

export type HostPhase = "lobby" | "question" | "counts" | "leaderboard" | "podium";
type Counts = [number, number, number, number];

export type HostState = {
  phase: HostPhase;
  gameId: string;
  pin: string;
  /** The question being played, from 1. 0 in the lobby. */
  round: number;
  totalQuestions: number;
  settings: GameSettings;
  /** Everyone in the game. */
  players: Player[];
  /** The open question with its four answer texts. The right one is not known until it closes. */
  question: HostQuestion | null;
  secondsLeft: number;
  /** Seconds of reading time left: the answers open when it reaches 0. */
  readingLeft: number;
  /** Players who sent an answer to the current question. */
  answered: number;
  /** Answers per position after the question closed. */
  counts: Counts | null;
  correct: AnswerPosition | null;
  standings: Standing[];
  /** The leaderboard before the latest one, so its rows can move from their old places. */
  previousStandings: Standing[];
  /** Suspected cheaters on the podium that the host has not ruled on. */
  cheaters: Cheater[];
  /** Another host screen took over this game: this one is finished. */
  replaced: boolean;
};

export type HostFlowEvent =
  | { type: "CREATED"; gameId: string; pin: string; totalQuestions: number }
  | { type: "SERVER"; event: HostEvent }
  | { type: "TICK" };

export const initialHostState: HostState = {
  phase: "lobby",
  gameId: "",
  pin: "",
  round: 0,
  totalQuestions: 0,
  settings: { showAnswers: false, scoring: "speed" },
  players: [],
  question: null,
  secondsLeft: 0,
  readingLeft: 0,
  answered: 0,
  counts: null,
  correct: null,
  standings: [],
  previousStandings: [],
  cheaters: [],
  replaced: false,
};

const PHASE: Record<ServerPhase, HostPhase> = {
  lobby: "lobby",
  question: "question",
  counts: "counts",
  leaderboard: "leaderboard",
  ended: "podium",
};

const toPlayers = (players: readonly PlayerPublic[]): Player[] => players.map((p) => ({ ...p, score: 0 }));
const toStandings = (rows: readonly ServerStanding[]): Standing[] => rows.map((row) => ({ ...row, isYou: false }));
const toCounts = (counts: readonly number[]): Counts => [counts[0] ?? 0, counts[1] ?? 0, counts[2] ?? 0, counts[3] ?? 0];

function applyServerEvent(state: HostState, event: HostEvent): HostState {
  switch (event.type) {
    case "host.state":
      // The picture the server sends after every connect: everything is set from it.
      return {
        ...state,
        phase: PHASE[event.phase],
        gameId: event.gameId,
        pin: event.pin,
        round: event.question?.index ?? (event.phase === "ended" || event.phase === "leaderboard" ? event.total : 0),
        totalQuestions: event.total,
        settings: event.settings,
        players: toPlayers(event.players),
        question: event.question,
        ...questionClock(event.question?.seconds ?? 0, event.remainingMs, event.readingMs),
        answered: event.answered,
        counts: event.counts ? toCounts(event.counts) : null,
        correct: event.correct,
        standings: event.standings ? toStandings(event.standings) : [],
        previousStandings: [],
        cheaters: event.cheaters ?? [],
      };
    case "lobby.updated":
      return { ...state, players: toPlayers(event.players) };
    case "question.started":
      return {
        ...state,
        phase: "question",
        round: event.question.index,
        question: event.question,
        ...questionClock(event.question.seconds, null, event.readingMs),
        answered: 0,
        counts: null,
        correct: null,
        cheaters: [],
      };
    case "cheaters":
      return { ...state, cheaters: event.cheaters };
    case "settings":
      return { ...state, settings: event.settings };
    case "answer.count":
      return state.phase === "question" ? { ...state, answered: event.answered } : state;
    case "question.closed":
      return { ...state, phase: "counts", counts: toCounts(event.counts), correct: event.correct };
    case "leaderboard":
      return { ...state, phase: "leaderboard", standings: toStandings(event.standings), previousStandings: state.standings };
    case "game.ended":
      return { ...state, phase: "podium", gameId: event.gameId, standings: toStandings(event.standings), cheaters: event.cheaters };
    case "replaced":
      return { ...state, replaced: true };
    case "game.closed": // the hook leaves for the dashboard
      return state;
    case "error":
      return state;
  }
}

export function hostReducer(state: HostState, event: HostFlowEvent): HostState {
  switch (event.type) {
    case "CREATED":
      return { ...state, gameId: event.gameId, pin: event.pin, totalQuestions: event.totalQuestions };
    case "SERVER":
      return applyServerEvent(state, event.event);
    case "TICK":
      // Only draws the clock. The server closes the question.
      return state.phase === "question" ? { ...state, ...tickClock(state) } : state;
  }
}
