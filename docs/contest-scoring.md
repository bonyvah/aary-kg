# Contest scoring model

Decided for Phase 4. The backend (Phase 5) implements exactly this.

## Who does what
- A **teacher** creates a contest and is its owner. An **admin** sees and manages every contest but does not create one.
- The owner defines **criteria**, adds **entries** (the things being judged: a name and a short description, no photos or uploads) and picks the **jury** from the teachers list (at least one).
- Jury members are teachers. A teacher can be the owner of one contest and a jury member of another.

## Criteria and coefficients
- Each criterion has a name and a **coefficient**: a number from **0.01 to 10** with at most 2 decimals. It is `1` by default, so criteria are equal until the owner makes one count more (`1.25`, `2`) or less (`0.5`).
- Coefficients do not have to add up to anything: adding or removing a criterion never means recalculating the others. The form shows each criterion's share of the total (`coefficient / sum of coefficients`) as a percentage, for information only.
- The comma is accepted as the decimal separator in the form.
- The server rejects a value outside the range or with more than 2 decimals with the code `COEFFICIENT_INVALID`, reported against the criterion (`criterion:<id>:coefficient`).
- Criteria and entries are locked once the contest is open (scoring started).

## Scoring
- Every jury member gives every entry a score from **1 to 5** for every criterion (whole numbers).
- One jury member's score for an entry = `sum(score x coefficient) / sum(coefficient)` over the criteria. It is a number from 1 to 5. With coefficients that are a ratio of the old percent weights, the result is identical.
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
`FIELD_REQUIRED`, `COEFFICIENT_INVALID`, `JURY_REQUIRED`, `ENTRIES_REQUIRED`, `CRITERIA_REQUIRED`.
