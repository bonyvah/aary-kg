export type ContestStatus = "draft" | "open" | "closed";

/** Whole-number score a jury member gives for one criterion. */
export type Score = 1 | 2 | 3 | 4 | 5;

export type Criterion = {
  id: string;
  name: string;
  /** How much the criterion counts: 0.01 to 10 with at most 2 decimals, 1 by default. Only the ratios matter. */
  coefficient: number;
};

/** Something being judged. Name and description only: no photos or uploads, ever. */
export type Entry = {
  id: string;
  name: string;
  description: string;
};

export type JuryMember = {
  userId: string;
  name: string;
  /** The jury member pressed «finish». Only finished jury members count in the final score. */
  finished: boolean;
};

/** scores[juryUserId][entryId][criterionId] */
export type ScoreSheet = Record<string, Record<string, Record<string, Score>>>;

export type Contest = {
  id: string;
  title: string;
  description: string;
  status: ContestStatus;
  ownerId: string;
  ownerName: string;
  /** ISO date-time. */
  createdAt: string;
  criteria: Criterion[];
  entries: Entry[];
  jury: JuryMember[];
  scores: ScoreSheet;
};

/** Stable codes of a failed save. The frontend turns them into translated text. */
export type ContestErrorCode =
  | "FIELD_REQUIRED"
  | "COEFFICIENT_INVALID"
  | "CRITERIA_REQUIRED"
  | "ENTRIES_REQUIRED"
  | "JURY_REQUIRED";

export type ContestIssue = {
  code: ContestErrorCode;
  /** The field that failed: `title`, `criteria`, `criterion:<id>:name`, `entry:<id>:name`, `jury`... */
  field: string;
};

export type RankedEntry = {
  entry: Entry;
  /** Average over the finished jury members, rounded to 2 decimals. Null when nobody scored it yet. */
  finalScore: number | null;
  /** Competition ranking (1, 1, 3). Null when there is no score. */
  rank: number | null;
  /** True when another entry has the same final score. */
  shared: boolean;
  /** Average per criterion over the finished jury members. */
  perCriterion: Record<string, number | null>;
  /** How many finished jury members scored this entry. */
  juryCount: number;
};

export type BreakdownRow = {
  userId: string;
  name: string;
  /** Null where this jury member left the criterion without a score. */
  scores: Record<string, Score | null>;
  /** This jury member's weighted score for the entry, at 2 decimals. */
  total: number | null;
};

/** What GET /contests/{id}/results answers. The server ranks; the browser only shows. */
export type ContestResults = {
  ranking: RankedEntry[];
  /** entryId to one row per finished jury member. Null unless the viewer owns the contest or is an admin. */
  breakdown: Record<string, BreakdownRow[]> | null;
};
