// Checks the admin helpers: the «create user» rules and the generated password.
// Run: pnpm check:admin
import { describeEdit, parseWhole } from "../src/lib/adminGame.ts";
import { homePath, redirectFor } from "../src/lib/staffRoutes.ts";
import { generatePassword, validateNewUser } from "../src/lib/adminUsers.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const existing = [{ login: "aizhan.m" }, { login: "Ulan.E" }];
const codes = (name: string, login: string) => JSON.stringify(validateNewUser({ name, login }, existing));
check("a good name and login pass", codes("Айжан", "new.user") === "{}");
check("empty name and login are FIELD_REQUIRED", codes(" ", " ") === '{"name":"FIELD_REQUIRED","login":"FIELD_REQUIRED"}');
check("a short login is LOGIN_INVALID", codes("A", "ab") === '{"login":"LOGIN_INVALID"}');
check("capitals are lowered, so they are fine", codes("A", "New.User") === "{}");
check("spaces and cyrillic are LOGIN_INVALID", codes("A", "бек зат") === '{"login":"LOGIN_INVALID"}');
check("a taken login is LOGIN_TAKEN, case does not matter", codes("A", "AIZHAN.M") === '{"login":"LOGIN_TAKEN"}' && codes("A", "ulan.e") === '{"login":"LOGIN_TAKEN"}');
check("a 33 character login is LOGIN_INVALID", codes("A", "a".repeat(33)) === '{"login":"LOGIN_INVALID"}' && codes("A", "a".repeat(32)) === "{}");

const passwords = Array.from({ length: 2000 }, () => generatePassword());
check("passwords look like xxxx-xxxx-xxxx", passwords.every((p) => /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(p)));
check("no ambiguous characters (0 O 1 l I)", passwords.every((p) => !/[0O1lI]/.test(p)));
check("2000 passwords are all different", new Set(passwords).size === passwords.length);
const counts = new Map<string, number>();
for (const p of passwords) for (const ch of p.replace(/-/g, "")) counts.set(ch, (counts.get(ch) ?? 0) + 1);
const values = [...counts.values()];
check("characters are spread evenly", values.length === 55 && Math.max(...values) / Math.min(...values) < 1.6, `${values.length} chars, min ${Math.min(...values)}, max ${Math.max(...values)}`);

// Where each role may go.
check("admins land on /admin, users on /dashboard", homePath("admin") === "/admin" && homePath("user") === "/dashboard");
for (const path of ["/dashboard", "/quizzes", "/quizzes/new", "/quizzes/abc", "/host/abc", "/contests/new"])
  check(`an admin is sent away from ${path}`, redirectFor("admin", path) === "/admin");
for (const path of ["/admin", "/admin/games/abc", "/contests/abc", "/reports/abc"])
  check(`an admin may open ${path}`, redirectFor("admin", path) === null);
check("a user is sent away from /admin and below", redirectFor("user", "/admin") === "/dashboard" && redirectFor("user", "/admin/games/abc") === "/dashboard");
check("a user keeps quizzes, hosting and contests", ["/dashboard", "/quizzes/new", "/host/abc", "/contests/new", "/administration"].every((path) => redirectFor("user", path) === null));

// Whole numbers in the edit fields.
check("whole numbers parse", parseWhole("12") === 12 && parseWhole(" -50 ") === -50 && parseWhole("+3") === 3 && parseWhole("0") === 0);
check("anything else is null", [" ", "", "1.5", "1e3", "abc", "12 3", "9999999999"].every((value) => parseWhole(value) === null));

// The edit log lines.
const questions = [
  { id: "q1", text: "A", answers: [], correct: 1 },
  { id: "q2", text: "B", answers: [], correct: 2 },
];
const line = (action: Parameters<typeof describeEdit>[0]["action"], detail: Record<string, unknown>) =>
  describeEdit({ at: "2026-01-01T00:00:00Z", adminName: "Admin", action, nickname: "Ulan", detail }, questions);
check("adjust line", line("adjust_score", { delta: -50, before: 900, after: 850 }).key === "adjust_score");
check("a right answer line names its number", JSON.stringify(line("edit_answer", { question: "q2", after: { correct: true, points: 500 } })) === '{"key":"edit_answer_right","values":{"nickname":"Ulan","number":2,"points":500}}');
check("a wrong answer line", line("edit_answer", { question: "q1", after: { correct: false, points: 0 } }).key === "edit_answer_wrong");
check("rename line has both names", JSON.stringify(line("rename_player", { before: "a", after: "b" }).values) === '{"before":"a","after":"b"}');
check("remove and clear lines", line("remove_player", {}).key === "remove_player" && line("clear_flag", { kind: "PASTE" }).values.kind === "PASTE");

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
