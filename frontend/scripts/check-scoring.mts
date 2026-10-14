// Checks the contest scoring model of docs/contest-scoring.md against numbers worked out by hand.
// Run: pnpm check:scoring (Node 22.6+ strips the types itself).
import { canManage, canScore, contestRole, entryBreakdown, finishedCount, jurorEntryScore, rankEntries, round2, scoredEntryCount, validateContest, weightsTotal } from "../src/lib/contestScoring.ts";
import { getMockContest } from "../src/mocks/contests.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const singers = getMockContest("singers")!;
const ranked = rankEntries(singers);
check("weights of the closed contest add up to 100", weightsTotal(singers.criteria) === 100);
check("final scores 4.67, 4.13, 4.13, 3.33, 2.33", JSON.stringify(ranked.map((r) => r.finalScore)) === JSON.stringify([4.67, 4.13, 4.13, 3.33, 2.33]), JSON.stringify(ranked.map((r) => r.finalScore)));
check("ranks 1, 2, 2, 4, 5 (shared rank, next place skipped)", JSON.stringify(ranked.map((r) => r.rank)) === JSON.stringify([1, 2, 2, 4, 5]), JSON.stringify(ranked.map((r) => r.rank)));
check("only the tied entries are marked shared", JSON.stringify(ranked.map((r) => r.shared)) === JSON.stringify([false, true, true, false, false]));
check("per-criterion average of the winner", ranked[0]!.perCriterion["closed-c1"] === 4.67 && ranked[0]!.perCriterion["closed-c3"] === 4.67, JSON.stringify(ranked[0]!.perCriterion));
check("three finished jury members counted", ranked.every((r) => r.juryCount === 3));

const photo = getMockContest("photo-contest")!;
const photoRanked = rankEntries(photo);
check("open contest counts only the finished jury member", photoRanked.every((r) => r.juryCount === 1) && photoRanked[0]!.finalScore === 4.5, JSON.stringify(photoRanked.map((r) => [r.finalScore, r.rank])));

const english = getMockContest("english-olympiad")!;
const englishRanked = rankEntries(english);
check("an entry nobody scored has no score and no rank", englishRanked.every((r) => r.finalScore === null && r.rank === null));

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

const winner = ranked[0]!.entry.id;
const rows = entryBreakdown(singers, winner);
check("the breakdown has one row per finished jury member, in jury order", rows.map((r) => r.name).join("|") === "Айжан Мамбетова|Өмүр Күмөш кызы|Гүлзат Токтогулова");
check("a breakdown row has the criteria scores and the weighted total", rows[0]!.total === 4.7 && rows[0]!.scores["closed-c1"] === 5 && rows[2]!.total === 4.6, JSON.stringify(rows.map((r) => r.total)));
check("the breakdown skips jury members who have not finished", entryBreakdown(photo, photo.entries[0]!.id).length === 1);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
