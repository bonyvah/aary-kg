// Checks the contest rules the browser still uses (coefficients, one jury member's score, permissions, the form check).
// Ranking and ties are the server's job now: backend/tests/test_contest_scoring.py has those numbers.
// Run: pnpm check:scoring (Node 22.6+ strips the types itself).
import { canManage, canScore, contestRole, finishedCount, jurorEntryScore, round2, scoredEntryCount, validateContest, coefficientShare, isValidCoefficient, parseCoefficient } from "../src/lib/contestScoring.ts";
import { getMockContest } from "./fixtures/contests.mts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const singers = getMockContest("singers")!;
check("coefficients: 0.01 to 10 with at most 2 decimals", [0.01, 0.5, 1, 1.25, 10].every(isValidCoefficient) && [0, -1, 0.001, 1.005, 10.01, Number.NaN, Infinity].every((v) => !isValidCoefficient(v)));
check("the comma is a decimal separator and empty is NaN", parseCoefficient("1,25") === 1.25 && parseCoefficient(" 2 ") === 2 && Number.isNaN(parseCoefficient("")));
check("shares: 1, 1, 2 gives 25%, 25%, 50%; an invalid one gets 0", coefficientShare(2, [1, 1, 2]) === 0.5 && coefficientShare(1, [1, 1, 2]) === 0.25 && coefficientShare(Number.NaN, [1, Number.NaN]) === 0);

const photo = getMockContest("photo-contest")!;
const english = getMockContest("english-olympiad")!;

check("jurorEntryScore is null while a criterion is missing", jurorEntryScore(singers.criteria, { "closed-c1": 5, "closed-c2": 4 }) === null);
check("jurorEntryScore: 5,4,5 with coefficients 4/3/3 = 4.7", round2(jurorEntryScore(singers.criteria, { "closed-c1": 5, "closed-c2": 4, "closed-c3": 5 })!) === 4.7);
check("only the ratio of coefficients matters", round2(jurorEntryScore(singers.criteria.map((c) => ({ ...c, coefficient: c.coefficient / 10 })), { "closed-c1": 5, "closed-c2": 4, "closed-c3": 5 })!) === 4.7);
check("round2 handles 1.005-like values", round2(2.675) === 2.68 && round2(4.1333333) === 4.13);

const base = { title: "T", criteria: [{ id: "a", name: "A", coefficient: 6 }, { id: "b", name: "B", coefficient: 4 }], entries: [{ id: "e", name: "E", description: "" }], jury: [{ userId: "u", name: "U", finished: false }] };
check("a valid contest has no issues", validateContest(base).length === 0);
const codes = (draft: typeof base) => validateContest(draft).map((i) => i.code).join(",");
check("coefficients that add up to anything are fine", codes({ ...base, criteria: [{ id: "a", name: "A", coefficient: 1 }, { id: "b", name: "B", coefficient: 1.25 }, { id: "c", name: "C", coefficient: 10 }] }) === "");
const bad = (coefficient: number) => validateContest({ ...base, criteria: [{ id: "a", name: "A", coefficient: 1 }, { id: "b", name: "B", coefficient }] }).map((i) => `${i.code}@${i.field}`).join(",");
check("0, 0.001, 10.01 and NaN -> COEFFICIENT_INVALID on that criterion", [0, 0.001, 10.01, Number.NaN].every((v) => bad(v) === "COEFFICIENT_INVALID@criterion:b:coefficient"));
check("empty title, no criteria, no entries, no jury", codes({ title: " ", criteria: [], entries: [], jury: [] }) === "FIELD_REQUIRED,CRITERIA_REQUIRED,ENTRIES_REQUIRED,JURY_REQUIRED");
check("blank criterion and entry names are FIELD_REQUIRED", validateContest({ ...base, criteria: [{ id: "a", name: "", coefficient: 1 }], entries: [{ id: "e", name: " ", description: "" }] }).map((i) => i.field).join(",") === "criterion:a:name,entry:e:name");

const school = getMockContest("school-concert")!;
check("the owner and an admin manage a contest, another teacher does not", canManage(school, { id: "u-aizhan", role: "teacher" }) && canManage(school, { id: "x", role: "admin" }) && !canManage(school, { id: "u-ulan", role: "teacher" }));
check("a jury member scores only while it is open", canScore(photo, "u-omur") && !canScore(singers, "u-omur") && !canScore(school, "u-ulan") && !canScore(photo, "u-aizhan"));
check("contestRole tells owner, jury and neither", contestRole(photo, "u-aizhan") === "owner" && contestRole(english, "u-aizhan") === "jury" && contestRole(english, "u-gulzat") === null);
check("scoredEntryCount counts fully scored entries", scoredEntryCount(photo, "u-ulan") === 3 && scoredEntryCount(photo, "u-omur") === 0 && scoredEntryCount(singers, "u-gulzat") === 5);
check("finishedCount counts finished jury members", finishedCount(photo) === 1 && finishedCount(singers) === 3 && finishedCount(english) === 0);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
