// Checks the survey sheet editor's rules (the server's, in backend/app/services/survey_sheets.py).
// Run: pnpm check:surveys
import { blankQuestion, blankSheet, findIssues, maxChars, nextId, withKind, withLimitMode } from "../src/lib/surveyEditor.ts";
import { redirectFor } from "../src/lib/staffRoutes.ts";
import { issuesOf, toPayload, toggle } from "../src/lib/surveyAnswer.ts";
import type { SurveyQuestion } from "../src/types/survey.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const keys = (issues: Map<string, string>) => [...issues].map(([k, c]) => `${k}=${c}`).join();

check("a blank sheet has a blank title and question", keys(findIssues(blankSheet())) === "title=FIELD_REQUIRED,q1:text=FIELD_REQUIRED,q1:choice:1=FIELD_REQUIRED,q1:choice:2=FIELD_REQUIRED");
const filled = {
  title: "Term",
  questions: [
    { ...blankQuestion("a", "single"), text: "?", choices: ["x", "y"] },
    { id: "b", kind: "multi" as const, text: "?", required: true, choices: ["x", " ", "z"], limit: { mode: "min" as const, n: 4 } },
    { ...blankQuestion("c", "open"), text: " " },
  ],
};
check("blank choices, a limit above the choices and blank text", keys(findIssues(filled)) === "b:choice:2=FIELD_REQUIRED,b:limit=LIMIT_TOO_HIGH,c:text=FIELD_REQUIRED", keys(findIssues(filled)));

check("words are 6 characters, never over 650", maxChars(1) === 6 && maxChars(100) === 600 && maxChars(200) === 650);
check("new ids skip used ones", nextId([blankQuestion("q2"), blankQuestion("q3")]) === "q4" && nextId([]) === "q1");

const multi = withKind({ ...blankQuestion("a", "single"), text: "T", required: false, choices: ["1", "2", "3"] }, "multi");
check("single to multiple keeps text, required and choices", multi.kind === "multi" && multi.text === "T" && !multi.required && multi.choices.length === 3 && multi.limit.mode === "none");
const open = withKind(multi, "open");
check("to open drops the choices, keeps the text", open.kind === "open" && open.text === "T" && open.maxWords === 100 && !("choices" in open));
check("open to single starts with two blank choices", (() => { const q = withKind(open, "single"); return q.kind === "single" && q.choices.join("|") === "|"; })());
check("limit modes: none has no number, the others keep theirs or start at 1", JSON.stringify([withLimitMode(3, "none"), withLimitMode(null, "min"), withLimitMode(3, "exact")]) === '[{"mode":"none","n":null},{"mode":"min","n":1},{"mode":"exact","n":3}]');

check("the superadmin can't write or start surveys", redirectFor("superadmin", "/admin/surveys/sheets/new") === "/admin" && redirectFor("superadmin", "/admin/surveys/new") === "/admin" && redirectFor("superadmin", "/admin/surveys/x") === null);
check("an admin can", redirectFor("admin", "/admin/surveys/sheets/new") === null && redirectFor("admin", "/admin/surveys/new") === null);
check("a teacher and a student can't", redirectFor("teacher", "/admin/surveys/x") === "/dashboard" && redirectFor("student", "/admin/surveys/x") === "/student");

const qs: SurveyQuestion[] = [
  { id: "s", kind: "single", text: "?", required: true, choices: ["a", "b"] },
  { id: "min", kind: "multi", text: "?", required: true, choices: ["a", "b", "c"], limit: { mode: "min", n: 2 } },
  { id: "max", kind: "multi", text: "?", required: false, choices: ["a", "b", "c"], limit: { mode: "max", n: 1 } },
  { id: "o", kind: "open", text: "?", required: true, maxWords: 2 },
  { id: "opt", kind: "open", text: "?", required: false, maxWords: 100 },
];
const issues = (draft: Record<string, readonly number[] | string>, submitting: boolean) =>
  [...issuesOf(qs, draft, submitting)].map(([k, c]) => `${k}=${c}`).join();
check("nothing is wrong while typing an empty survey", issues({}, false) === "");
check("on sending, the mandatory ones are missing", issues({}, true) === "s=ANSWER_REQUIRED,min=ANSWER_REQUIRED,o=ANSWER_REQUIRED", issues({}, true));
check("a limit passed shows at once", issues({ max: [1, 2], o: "x".repeat(13) }, false) === "max=TOO_MANY,o=TOO_LONG");
check("too few shows only on sending", issues({ min: [1] }, false) === "" && issues({ s: [1], min: [1], o: "hi" }, true) === "min=TOO_FEW");
check("a blank text is no answer", issues({ s: [2], min: [1, 3], o: "   " }, true) === "o=ANSWER_REQUIRED");
const single = qs[0] as SurveyQuestion;
const multiQ = qs[1] as SurveyQuestion;
check("a single choice takes the one clicked", toggle(single, [1], 2).join() === "2");
check("a multiple select adds and removes in order", toggle(multiQ, [3], 1).join() === "1,3" && toggle(multiQ, [1, 3], 3).join() === "1");
check(
  "the payload has answered questions only, a single choice as a number, texts trimmed",
  JSON.stringify(toPayload(qs, { s: [2], min: [1, 3], max: [], o: "  hi ", opt: " " })) === '{"s":2,"min":[1,3],"o":"hi"}',
);

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall survey checks passed");
