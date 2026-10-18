// Checks reading quiz JSON pasted from a chat into the editor.
// Run: pnpm check:quiz-import
import { parseQuizJson } from "../src/lib/quizEditor/importJson.ts";

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
check("too long texts", codes(JSON.stringify([{ ...question, text: "x".repeat(501) }, { ...question, answers: ["a", "x".repeat(201)], correct: 1 }])) === "TEXT_TOO_LONG@1,ANSWER_TOO_LONG@2");
check("title must be a string", codes(JSON.stringify({ title: 5, questions: [question] })) === "TITLE_INVALID");
check("all or nothing: one bad question fails the import", !parseQuizJson(JSON.stringify([question, null]), 100).ok);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
