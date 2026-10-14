import { jurorEntryScore, round2 } from "@/lib/contestScoring";
import type { Contest, Score } from "@/types/contest";

type EntryScores = Record<string, Score>;

export type JuryState = {
  /** This jury member's scores: entryId then criterionId. */
  scores: Record<string, EntryScores>;
  /** The entry on screen. */
  index: number;
  /** The jury member pressed «finish». They can still change scores until the contest closes. */
  finished: boolean;
};

export type JuryEvent =
  | { type: "SCORE_SET"; entryId: string; criterionId: string; score: Score }
  | { type: "GO_TO"; index: number }
  | { type: "FINISHED" };

type Setup = Pick<Contest, "criteria" | "entries">;

export function initialJuryState(scores: Record<string, EntryScores> | undefined, finished: boolean): JuryState {
  return { scores: scores ?? {}, index: 0, finished };
}

/** This entry has a score for every criterion. */
export function isEntryComplete(setup: Setup, state: JuryState, entryId: string): boolean {
  return jurorEntryScore(setup.criteria, state.scores[entryId]) !== null;
}

export function completeCount(setup: Setup, state: JuryState): number {
  return setup.entries.filter((entry) => isEntryComplete(setup, state, entry.id)).length;
}

/** «Finish» needs every entry fully scored. */
export function canFinish(setup: Setup, state: JuryState): boolean {
  return setup.entries.length > 0 && completeCount(setup, state) === setup.entries.length;
}

/** The running score of one entry, at the 2 decimals it is shown with. Null until every criterion has a score. */
export function runningScore(setup: Setup, state: JuryState, entryId: string): number | null {
  const total = jurorEntryScore(setup.criteria, state.scores[entryId]);
  return total === null ? null : round2(total);
}

export function juryReducer(setup: Setup, state: JuryState, event: JuryEvent): JuryState {
  switch (event.type) {
    case "SCORE_SET":
      return {
        ...state,
        scores: { ...state.scores, [event.entryId]: { ...state.scores[event.entryId], [event.criterionId]: event.score } },
      };
    case "GO_TO":
      return { ...state, index: Math.min(Math.max(0, event.index), Math.max(0, setup.entries.length - 1)) };
    case "FINISHED":
      return canFinish(setup, state) ? { ...state, finished: true } : state;
  }
}
