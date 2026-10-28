// Checks reading quiz JSON pasted from a chat into the editor.
// Run: pnpm check:quiz-import
import { parseQuizJson } from "../src/lib/quizEditor/importJson.ts";
import { blankQuiz, editorReducer, initialEditorState } from "../src/lib/quizEditor/reducer.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const question = { text: "2 + 2?", answers: ["3", "4", "5", "6"], correct: 2, seconds: 30 };
const quiz = JSON.stringify({ title: "Math", questions: [question] });
const codes = (raw: string, room = 100) => {
  const result = parseQuizJson(raw, room);
  return result.ok ? "" : result.errors.map((e) => `${e.code}${e.question ? "@" + e.question : ""}`).join();
};

const plain = parseQuizJson(quiz, 100);
check("a valid quiz is read with its title", plain.ok && plain.title === "Math" && plain.questions[0]?.correct === 2 && plain.questions[0]?.seconds === 30);
check("a fenced reply with text around it is read", parseQuizJson("Here it is:\n```json\n" + quiz + "\n```\nGood luck!", 100).ok);
check("the questions array alone is read, with no title", (() => { const r = parseQuizJson(JSON.stringify([question]), 100); return r.ok && r.title === null; })());
check("seconds is optional and defaults to 20", (() => { const r = parseQuizJson(JSON.stringify([{ ...question, seconds: undefined }]), 100); return r.ok && r.questions[0]?.seconds === 20; })());
check("readSeconds is optional and defaults to 3, or is kept", (() => { const r = parseQuizJson(JSON.stringify([question, { ...question, readSeconds: 10 }]), 100); return r.ok && r.questions[0]?.readSeconds === 3 && r.questions[1]?.readSeconds === 10; })());
check("two answers are padded to four tiles", (() => { const r = parseQuizJson(JSON.stringify([{ ...question, answers: ["Yes", "No"], correct: 1 }]), 100); return r.ok && r.questions[0]?.answers.join("|") === "Yes|No||"; })());
check("texts are trimmed", (() => { const r = parseQuizJson(JSON.stringify([{ ...question, text: "  Q  " }]), 100); return r.ok && r.questions[0]?.text === "Q"; })());

check("not JSON", codes("no quiz here") === "NOT_JSON");
check("no questions", codes(JSON.stringify({ title: "x", questions: [] })) === "NO_QUESTIONS");
check("more questions than the quiz has room for", codes(JSON.stringify([question, question]), 1) === "TOO_MANY_QUESTIONS");
check("errors name the question number", codes(JSON.stringify([question, { ...question, text: "" }])) === "TEXT_MISSING@2");
check("one answer is too few, five too many", codes(JSON.stringify([{ ...question, answers: ["a"], correct: 1 }, { ...question, answers: ["a", "b", "c", "d", "e"] }])) === "ANSWERS_COUNT@1,ANSWERS_COUNT@2");
check("blank answer", codes(JSON.stringify([{ ...question, answers: ["a", " ", "c", "d"] }])) === "ANSWER_INVALID@1");
check("correct must point at an answer, 1-based", codes(JSON.stringify([{ ...question, correct: 0 }, { ...question, answers: ["a", "b"], correct: 3 }, { ...question, correct: "2" }])) === "CORRECT_INVALID@1,CORRECT_INVALID@2,CORRECT_INVALID@3");
check("seconds outside 5 to 300", codes(JSON.stringify([{ ...question, seconds: 2 }, { ...question, seconds: 301 }])) === "SECONDS_INVALID@1,SECONDS_INVALID@2");
check("readSeconds outside 3 to 10", codes(JSON.stringify([{ ...question, readSeconds: 2 }, { ...question, readSeconds: 11 }])) === "READ_SECONDS_INVALID@1,READ_SECONDS_INVALID@2");
check("too long texts", codes(JSON.stringify([{ ...question, text: "x".repeat(501) }, { ...question, answers: ["a", "x".repeat(201)], correct: 1 }])) === "TEXT_TOO_LONG@1,ANSWER_TOO_LONG@2");
check("title must be a string", codes(JSON.stringify({ title: 5, questions: [question] })) === "TITLE_INVALID");
check("all or nothing: one bad question fails the import", !parseQuizJson(JSON.stringify([question, null]), 100).ok);

// Adding the read questions to the editor.
const imported = { type: "QUESTIONS_IMPORTED", title: "Math", questions: [{ ...question, correct: 2 as const, answers: ["3", "4", "5", "6"] as [string, string, string, string] }] } as const;
const fresh = editorReducer(initialEditorState(blankQuiz()), imported);
check("a new quiz: the blank starter question is replaced, the title filled", fresh.doc.questions.length === 1 && fresh.doc.questions[0]?.text === "2 + 2?" && fresh.doc.title === "Math");
check("the first imported question is selected", fresh.selectedId === fresh.doc.questions[0]?.id);
const twice = editorReducer(fresh, { ...imported, title: "Other" });
check("importing again appends and keeps the title", twice.doc.questions.length === 2 && twice.doc.title === "Math" && twice.selectedId === twice.doc.questions[1]?.id);
check("ids stay unique", new Set(twice.doc.questions.map((q) => q.id)).size === 2);
const loaded = initialEditorState({ id: "q1", title: "", status: "draft", questions: [{ id: "question-2", text: "A", answers: ["a", "b", "", ""], correct: 1, seconds: 20 }] });
const afterLoaded = editorReducer(loaded, imported);
check("a saved question is kept in front, its id not reused", afterLoaded.doc.questions[0]?.id === "question-2" && afterLoaded.doc.questions[1]?.id !== "question-2");
check("nothing to import changes nothing", editorReducer(fresh, { ...imported, questions: [] }) === fresh);

// A new question takes the times of the one before it.
const filled = editorReducer(
  editorReducer(editorReducer(editorReducer(initialEditorState(blankQuiz()), { type: "QUESTION_TEXT_CHANGED", text: "Q" }), { type: "ANSWER_TEXT_CHANGED", position: 1, text: "a" }), { type: "ANSWER_TEXT_CHANGED", position: 2, text: "b" }),
  { type: "QUESTION_CHANGED", change: { readSeconds: 7 } },
);
const added = editorReducer(filled, { type: "QUESTION_ADDED" });
check("a new question starts with the reading time of the one before", added.doc.questions.length === 2 && added.doc.questions[1]?.readSeconds === 7);
check("a new quiz reads for 3 seconds", blankQuiz().questions[0]?.readSeconds === 3);

// Reordering: a question moves to a place, the others keep their order.
const three = editorReducer(twice, { ...imported, title: null });
const order = (state: typeof three) => state.doc.questions.map((q) => q.id).join();
const first = three.doc.questions[0]!.id;
const moved = editorReducer(three, { type: "QUESTION_MOVED", id: first, to: 2 });
check("a question moves down", order(moved) === [...three.doc.questions.slice(1).map((q) => q.id), first].join());
check("moving past the end stops at the end", order(editorReducer(three, { type: "QUESTION_MOVED", id: first, to: 99 })) === order(moved));
check("moving in place changes nothing", editorReducer(three, { type: "QUESTION_MOVED", id: first, to: 0 }) === three);
check("a replaced document starts over", editorReducer(three, { type: "DOC_REPLACED", doc: blankQuiz() }).doc.questions.length === 1);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
