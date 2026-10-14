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
  fields([{ type: "SAVED" }]) === "FIELD_REQUIRED@title FIELD_REQUIRED@criterion:criterion-1:name FIELD_REQUIRED@entry:entry-1:name JURY_REQUIRED@jury",
  fields([{ type: "SAVED" }]));

const filled: ContestFormEvent[] = [
  { type: "TITLE_CHANGED", value: "Сынак" },
  { type: "CRITERION_CHANGED", id: "criterion-1", field: "name", value: "Идея" },
  { type: "ENTRY_CHANGED", id: "entry-1", field: "name", value: "Бир" },
  { type: "JURY_TOGGLED", userId: "u-ulan" },
];
check("a filled form with one criterion of 100 saves", run([...filled, { type: "SAVED" }]).saveResult === "saved");

const two: ContestFormEvent[] = [
  ...filled,
  { type: "CRITERION_ADDED" },
  { type: "CRITERION_CHANGED", id: "criterion-2", field: "name", value: "Аткаруу" },
  { type: "CRITERION_CHANGED", id: "criterion-2", field: "weight", value: "30" },
];
check("weights 100 + 30 fail with WEIGHTS_NOT_100", fields([...two, { type: "SAVED" }]) === "WEIGHTS_NOT_100@criteria", fields([...two, { type: "SAVED" }]));
const fixed: ContestFormEvent[] = [...two, { type: "CRITERION_CHANGED", id: "criterion-1", field: "weight", value: "70" }];
check("70 + 30 saves", run([...fixed, { type: "SAVED" }]).saveResult === "saved");
check("a decimal weight fails", fields([...two, { type: "CRITERION_CHANGED", id: "criterion-1", field: "weight", value: "70.5" }, { type: "SAVED" }]) === "WEIGHTS_NOT_100@criteria");
check("an empty weight fails", fields([...two, { type: "CRITERION_CHANGED", id: "criterion-2", field: "weight", value: "" }, { type: "SAVED" }]) === "WEIGHTS_NOT_100@criteria");

const failedOnce = run([{ type: "SAVED" }]);
const afterTitle = contestFormReducer(failedOnce, { type: "TITLE_CHANGED", value: "X" });
check("typing a title clears only the title error", !afterTitle.issues.some((i) => i.field === "title") && afterTitle.issues.length === failedOnce.issues.length - 1);
const afterJury = contestFormReducer(failedOnce, { type: "JURY_TOGGLED", userId: "u-ulan" });
check("picking a jury member clears the jury error", !afterJury.issues.some((i) => i.field === "jury"));
check("removing the last criterion gives CRITERIA_REQUIRED", fields([...filled, { type: "CRITERION_REMOVED", id: "criterion-1" }, { type: "SAVED" }]) === "CRITERIA_REQUIRED@criteria");
check("removing the last entry gives ENTRIES_REQUIRED", fields([...filled, { type: "ENTRY_REMOVED", id: "entry-1" }, { type: "SAVED" }]) === "ENTRIES_REQUIRED@entries");
check("toggling a jury member twice removes them", run([{ type: "JURY_TOGGLED", userId: "a" }, { type: "JURY_TOGGLED", userId: "a" }]).juryIds.length === 0);
check("new rows get distinct ids", new Set(run([{ type: "CRITERION_ADDED" }, { type: "ENTRY_ADDED" }, { type: "CRITERION_ADDED" }]).criteria.map((c) => c.id)).size === 3);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
