import type {
  Contest,
  Criterion,
  ContestIssue,
  Score,
} from "@/types/contest";

// The model is written in docs/contest-scoring.md. Weights add up to 100, scores go from 1 to 5,
// the final score is the jury average, and equal scores share the rank.

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;
export const SCORES: readonly Score[] = [1, 2, 3, 4, 5];

/** Scores are compared the way they are shown: at 2 decimals. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function weightsTotal(criteria: readonly Pick<Criterion, "weight">[]): number {
  return criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
}

/** One jury member's score for one entry. Null until every criterion has a score. */
export function jurorEntryScore(
  criteria: readonly Criterion[],
  scores: Readonly<Record<string, Score>> | undefined,
): number | null {
  if (criteria.length === 0 || !scores) return null;
  let total = 0;
  for (const criterion of criteria) {
    const score = scores[criterion.id];
    if (score === undefined) return null;
    total += (score * criterion.weight) / 100;
  }
  return total;
}

type ContestDraft = Pick<Contest, "title" | "criteria" | "entries" | "jury">;

/** The check the server runs on save. Returns what is wrong, an empty list when the contest is fine. */
export function validateContest(draft: ContestDraft): ContestIssue[] {
  const issues: ContestIssue[] = [];
  if (draft.title.trim() === "") issues.push({ code: "FIELD_REQUIRED", field: "title" });

  if (draft.criteria.length === 0) {
    issues.push({ code: "CRITERIA_REQUIRED", field: "criteria" });
  } else {
    for (const criterion of draft.criteria) {
      if (criterion.name.trim() === "") issues.push({ code: "FIELD_REQUIRED", field: `criterion:${criterion.id}:name` });
    }
    const total = weightsTotal(draft.criteria);
    const eachValid = draft.criteria.every((c) => Number.isInteger(c.weight) && c.weight >= 1 && c.weight <= 100);
    if (total !== 100 || !eachValid) issues.push({ code: "WEIGHTS_NOT_100", field: "criteria" });
  }

  if (draft.entries.length === 0) {
    issues.push({ code: "ENTRIES_REQUIRED", field: "entries" });
  } else {
    for (const entry of draft.entries) {
      if (entry.name.trim() === "") issues.push({ code: "FIELD_REQUIRED", field: `entry:${entry.id}:name` });
    }
  }

  if (draft.jury.length === 0) issues.push({ code: "JURY_REQUIRED", field: "jury" });
  return issues;
}

export type ContestRole = "owner" | "jury";

/** How a user relates to a contest. Null when they are neither (an admin still sees it). */
export function contestRole(contest: Pick<Contest, "ownerId" | "jury">, userId: string): ContestRole | null {
  if (contest.ownerId === userId) return "owner";
  return contest.jury.some((member) => member.userId === userId) ? "jury" : null;
}

export function finishedCount(contest: Pick<Contest, "jury">): number {
  return contest.jury.filter((member) => member.finished).length;
}

type Viewer = { id: string; role: "admin" | "user" };

/** Owner and admins manage a contest: open scoring, close it. */
export function canManage(contest: Pick<Contest, "ownerId">, viewer: Viewer): boolean {
  return viewer.role === "admin" || contest.ownerId === viewer.id;
}

/** A jury member can score while the contest is open. */
export function canScore(contest: Pick<Contest, "status" | "jury">, userId: string): boolean {
  return contest.status === "open" && contest.jury.some((member) => member.userId === userId);
}

/** How many entries this jury member has fully scored (every criterion). */
export function scoredEntryCount(contest: Pick<Contest, "criteria" | "entries" | "scores">, userId: string): number {
  return contest.entries.filter((entry) => jurorEntryScore(contest.criteria, contest.scores[userId]?.[entry.id]) !== null).length;
}
