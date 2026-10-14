export type ContestStatus = "draft" | "open" | "closed";

/** Whole-number score a jury member gives for one criterion. */
export type Score = 1 | 2 | 3 | 4 | 5;

export type Criterion = {
  id: string;
  name: string;
  /** Percent, a whole number from 1 to 100. The weights of a contest add up to 100. */
  weight: number;
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
  criteria: Criterion[];
  entries: Entry[];
  jury: JuryMember[];
  scores: ScoreSheet;
};

/** Stable codes of a failed save. The frontend turns them into translated text. */
export type ContestErrorCode =
  | "FIELD_REQUIRED"
  | "WEIGHTS_NOT_100"
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
