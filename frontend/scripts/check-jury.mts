// Checks the jury scoring state: the running score, when «finish» is allowed, and the entry navigation.
// Run: pnpm check:jury
import { canFinish, completeCount, initialJuryState, juryReducer, runningScore, type JuryEvent } from "../src/lib/juryScoring/reducer.ts";
import { getMockContest } from "../src/mocks/contests.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const contest = getMockContest("english-olympiad")!; // 3 criteria (50, 30, 20), 4 entries, nobody scored yet
const [c1, c2, c3] = contest.criteria.map((c) => c.id) as [string, string, string];
const entry = (n: number) => contest.entries[n - 1]!.id;
const run = (events: JuryEvent[], from = initialJuryState(undefined, false)) => events.reduce((state, e) => juryReducer(contest, state, e), from);

check("nothing is scored at the start and finish is not allowed", completeCount(contest, run([])) === 0 && !canFinish(contest, run([])));
check("no running score until every criterion is set", runningScore(contest, run([{ type: "SCORE_SET", entryId: entry(1), criterionId: c1, score: 5 }, { type: "SCORE_SET", entryId: entry(1), criterionId: c2, score: 4 }]), entry(1)) === null);
const first = run([
  { type: "SCORE_SET", entryId: entry(1), criterionId: c1, score: 5 },
  { type: "SCORE_SET", entryId: entry(1), criterionId: c2, score: 4 },
  { type: "SCORE_SET", entryId: entry(1), criterionId: c3, score: 3 },
]);
check("5, 4, 3 with weights 50/30/20 gives 4.3", runningScore(contest, first, entry(1)) === 4.3, String(runningScore(contest, first, entry(1))));
check("changing a score updates the running score (4 instead of 5 -> 3.8)", runningScore(contest, run([{ type: "SCORE_SET", entryId: entry(1), criterionId: c1, score: 4 }], first), entry(1)) === 3.8);
check("one complete entry is counted", completeCount(contest, first) === 1);

const all = contest.entries.flatMap((e) => [c1, c2, c3].map((criterionId) => ({ type: "SCORE_SET" as const, entryId: e.id, criterionId, score: 3 as const })));
const almost = run(all.slice(0, all.length - 1));
check("one criterion missing on the last entry: finish is refused", !canFinish(contest, almost) && !run([{ type: "FINISHED" }], almost).finished);
const done = run(all);
check("everything scored: finish is allowed and sets finished", canFinish(contest, done) && run([{ type: "FINISHED" }], done).finished);
check("scores can still be changed after finishing", run([{ type: "SCORE_SET", entryId: entry(2), criterionId: c1, score: 5 }], run([{ type: "FINISHED" }], done)).scores[entry(2)]?.[c1] === 5);
check("navigation stays inside the list", run([{ type: "GO_TO", index: 99 }]).index === 3 && run([{ type: "GO_TO", index: -4 }]).index === 0 && run([{ type: "GO_TO", index: 2 }]).index === 2);
const resumed = initialJuryState(getMockContest("photo-contest")!.scores["u-ulan"], true);
check("a jury member who already scored starts with their scores and finished", resumed.finished && completeCount(getMockContest("photo-contest")!, resumed) === 3);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
