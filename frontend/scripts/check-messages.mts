// Checks the Kyrgyz review list: every key in `_todo_review` exists in ky.json with the same text.
// Run: pnpm check:messages
import { readFileSync } from "node:fs";

type Tree = { [key: string]: string | Tree };
const ky = JSON.parse(readFileSync(new URL("../messages/ky.json", import.meta.url), "utf8")) as Tree & { _todo_review: Record<string, string> };

const at = (path: string): string | Tree | undefined =>
  path.split(".").reduce<string | Tree | undefined>((node, part) => (typeof node === "object" ? node[part] : undefined), ky);

let failed = 0;
for (const [key, text] of Object.entries(ky._todo_review)) {
  const actual = at(key);
  if (actual !== text) {
    failed += 1;
    console.log(`FAIL ${key}: ${actual === undefined ? "no such key" : `ky.json has «${String(actual)}», _todo_review has «${text}»`}`);
  }
}
if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log(`ok   ${Object.keys(ky._todo_review).length} Kyrgyz strings to review, all match ky.json`);
