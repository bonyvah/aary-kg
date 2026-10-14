# Contest scoring model

Decided for Phase 4. The backend (Phase 5) implements exactly this.

## Who does what
- A **user** creates a contest and is its owner. An **admin** sees and manages every contest.
- The owner defines **criteria**, adds **entries** (the things being judged: a name and a short description, no photos or uploads) and picks the **jury** from the users list (at least one).
- Jury members are users. A user can be the owner of one contest and a jury member of another.

## Criteria and weights
- Each criterion has a name and a **weight in percent**, a whole number from 1 to 100.
- The weights of a contest add up to exactly **100**. The server rejects anything else with the code `WEIGHTS_NOT_100`.
- Criteria and entries are locked once the contest is open (scoring started).

## Scoring
- Every jury member gives every entry a score from **1 to 5** for every criterion (whole numbers).
- One jury member's score for an entry = the sum over the criteria of `score x weight / 100`. It is a number from 1 to 5.
- The **final score** of an entry = the average of those scores over the jury members who finished scoring.
- A jury member can change their scores until the contest is closed.

## Ranking and ties
- Entries are ranked by final score, highest first.
- **Ties: shared rank only.** Scores are compared at **2 decimals**, the way they are shown. Equal scores share the place and the next place is skipped (1, 1, 3). There is no further tie-break rule.

## States
- `draft`: the owner is still editing. Nobody scores.
- `open`: jury members score. The owner and admins see how many have finished.
- `closed`: results are final and visible. A closed contest cannot be reopened.

## Error codes (the backend sends codes, the frontend translates them)
`FIELD_REQUIRED`, `WEIGHTS_NOT_100`, `JURY_REQUIRED`, `ENTRIES_REQUIRED`, `CRITERIA_REQUIRED`.
