// Checks the admin helpers: the «create user» rules and the generated password.
// Run: pnpm check:admin
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

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
