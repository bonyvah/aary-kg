// Checks the contest form state: what the save finds wrong, and that fixing a field clears its error.
// Run: pnpm check:contest-form
import { contestFormReducer, initialContestForm, type ContestFormEvent } from "../src/lib/contestForm/reducer.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};
const run = (events: ContestFormEvent[]) => events.reduce(contestFormReducer, initialContestForm);
const fields = (events: ContestFormEvent[]) => run(events).issues.map((i) => `${i.code}@${i.field}`).join(" ");

check("an empty form fails on the title, the criterion name, the entry name and the jury",
  fields([{ type: "VALIDATED" }]) === "FIELD_REQUIRED@title FIELD_REQUIRED@criterion:criterion-1:name FIELD_REQUIRED@entry:entry-1:name JURY_REQUIRED@jury",
  fields([{ type: "VALIDATED" }]));

const filled: ContestFormEvent[] = [
  { type: "TITLE_CHANGED", value: "Сынак" },
  { type: "CRITERION_CHANGED", id: "criterion-1", field: "name", value: "Идея" },
  { type: "ENTRY_CHANGED", id: "entry-1", field: "name", value: "Бир" },
  { type: "JURY_TOGGLED", userId: "u-ulan" },
];
check("a filled form with one criterion of 1 passes the check", run([...filled, { type: "VALIDATED" }]).saveResult === null);

const two: ContestFormEvent[] = [
  ...filled,
  { type: "CRITERION_ADDED" },
  { type: "CRITERION_CHANGED", id: "criterion-2", field: "name", value: "Аткаруу" },
];
const setSecond = (value: string): ContestFormEvent[] => [...two, { type: "CRITERION_CHANGED", id: "criterion-2", field: "coefficient", value }, { type: "VALIDATED" }];
check("a new criterion starts at 1, so two criteria pass the check", run(setSecond("1")).saveResult === null && run(two).criteria[1]?.coefficient === "1");
check("1,25 (comma) and 10 pass the check", run(setSecond("1,25")).saveResult === null && run(setSecond("10")).saveResult === null);
check("0, 10.5, three decimals and empty fail on that criterion", ["0", "10.5", "1.005", ""].every((v) => fields(setSecond(v)) === "COEFFICIENT_INVALID@criterion:criterion-2:coefficient"));
check("fixing the coefficient clears its error", !contestFormReducer(run(setSecond("0")), { type: "CRITERION_CHANGED", id: "criterion-2", field: "coefficient", value: "1" }).issues.some((i) => i.code === "COEFFICIENT_INVALID"));

const failedOnce = run([{ type: "VALIDATED" }]);
const afterTitle = contestFormReducer(failedOnce, { type: "TITLE_CHANGED", value: "X" });
check("typing a title clears only the title error", !afterTitle.issues.some((i) => i.field === "title") && afterTitle.issues.length === failedOnce.issues.length - 1);
const afterJury = contestFormReducer(failedOnce, { type: "JURY_TOGGLED", userId: "u-ulan" });
check("picking a jury member clears the jury error", !afterJury.issues.some((i) => i.field === "jury"));
check("removing the last criterion gives CRITERIA_REQUIRED", fields([...filled, { type: "CRITERION_REMOVED", id: "criterion-1" }, { type: "VALIDATED" }]) === "CRITERIA_REQUIRED@criteria");
check("removing the last entry gives ENTRIES_REQUIRED", fields([...filled, { type: "ENTRY_REMOVED", id: "entry-1" }, { type: "VALIDATED" }]) === "ENTRIES_REQUIRED@entries");
check("toggling a jury member twice removes them", run([{ type: "JURY_TOGGLED", userId: "a" }, { type: "JURY_TOGGLED", userId: "a" }]).juryIds.length === 0);
check("new rows get distinct ids", new Set(run([{ type: "CRITERION_ADDED" }, { type: "ENTRY_ADDED" }, { type: "CRITERION_ADDED" }]).criteria.map((c) => c.id)).size === 3);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
