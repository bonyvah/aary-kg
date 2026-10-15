// Checks the contest rules the browser still uses (weights, one jury member's score, permissions, the form check).
// Ranking and ties are the server's job now: backend/tests/test_contest_scoring.py has those numbers.
// Run: pnpm check:scoring (Node 22.6+ strips the types itself).
import { canManage, canScore, contestRole, finishedCount, jurorEntryScore, round2, scoredEntryCount, validateContest, weightsTotal } from "../src/lib/contestScoring.ts";
import { getMockContest } from "./fixtures/contests.mts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const singers = getMockContest("singers")!;
check("weights of the closed contest add up to 100", weightsTotal(singers.criteria) === 100);

const photo = getMockContest("photo-contest")!;
const english = getMockContest("english-olympiad")!;

check("jurorEntryScore is null while a criterion is missing", jurorEntryScore(singers.criteria, { "closed-c1": 5, "closed-c2": 4 }) === null);
check("jurorEntryScore weights: 5,4,5 with 40/30/30 = 4.7", round2(jurorEntryScore(singers.criteria, { "closed-c1": 5, "closed-c2": 4, "closed-c3": 5 })!) === 4.7);
check("round2 handles 1.005-like values", round2(2.675) === 2.68 && round2(4.1333333) === 4.13);

const base = { title: "T", criteria: [{ id: "a", name: "A", weight: 60 }, { id: "b", name: "B", weight: 40 }], entries: [{ id: "e", name: "E", description: "" }], jury: [{ userId: "u", name: "U", finished: false }] };
check("a valid contest has no issues", validateContest(base).length === 0);
const codes = (draft: typeof base) => validateContest(draft).map((i) => i.code).join(",");
check("weights 90 -> WEIGHTS_NOT_100", codes({ ...base, criteria: [{ id: "a", name: "A", weight: 50 }, { id: "b", name: "B", weight: 40 }] }) === "WEIGHTS_NOT_100");
check("weight 0 or decimal -> WEIGHTS_NOT_100", codes({ ...base, criteria: [{ id: "a", name: "A", weight: 100 }, { id: "b", name: "B", weight: 0 }] }) === "WEIGHTS_NOT_100" && codes({ ...base, criteria: [{ id: "a", name: "A", weight: 60.5 }, { id: "b", name: "B", weight: 39.5 }] }) === "WEIGHTS_NOT_100");
check("empty title, no criteria, no entries, no jury", codes({ title: " ", criteria: [], entries: [], jury: [] }) === "FIELD_REQUIRED,CRITERIA_REQUIRED,ENTRIES_REQUIRED,JURY_REQUIRED");
check("blank criterion and entry names are FIELD_REQUIRED", validateContest({ ...base, criteria: [{ id: "a", name: "", weight: 100 }], entries: [{ id: "e", name: " ", description: "" }] }).map((i) => i.field).join(",") === "criterion:a:name,entry:e:name");

const school = getMockContest("school-concert")!;
check("the owner and an admin manage a contest, another user does not", canManage(school, { id: "u-aizhan", role: "user" }) && canManage(school, { id: "x", role: "admin" }) && !canManage(school, { id: "u-ulan", role: "user" }));
check("a jury member scores only while it is open", canScore(photo, "u-omur") && !canScore(singers, "u-omur") && !canScore(school, "u-ulan") && !canScore(photo, "u-aizhan"));
check("contestRole tells owner, jury and neither", contestRole(photo, "u-aizhan") === "owner" && contestRole(english, "u-aizhan") === "jury" && contestRole(english, "u-gulzat") === null);
check("scoredEntryCount counts fully scored entries", scoredEntryCount(photo, "u-ulan") === 3 && scoredEntryCount(photo, "u-omur") === 0 && scoredEntryCount(singers, "u-gulzat") === 5);
check("finishedCount counts finished jury members", finishedCount(photo) === 1 && finishedCount(singers) === 3 && finishedCount(english) === 0);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
