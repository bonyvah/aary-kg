// The player side must load no staff or auth code (CLAUDE.md). After `pnpm build`, this reads the
// JavaScript the player page ships (root layout + the `/` page) and fails if it contains anything
// that belongs to the staff side: its API paths, its session code, its cookie.
// Run: pnpm build && pnpm check:bundle
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = ".next";
const MANIFEST = join(NEXT_DIR, "app-build-manifest.json");
if (!existsSync(MANIFEST)) {
  console.error("No build found: run `pnpm build` first.");
  process.exit(1);
}

const pages = JSON.parse(readFileSync(MANIFEST, "utf8")).pages;
const ENTRIES = ["/layout", "/(player)/page"];
for (const entry of ENTRIES) {
  if (!pages[entry]) {
    console.error(`The build has no ${entry}: did the route layout change? Update scripts/check-player-bundle.mjs.`);
    process.exit(1);
  }
}

// Text that only staff code contains.
const STAFF_MARKERS = [
  ["/auth/me", "the staff session check"],
  ["/auth/login", "staff sign-in"],
  ["/auth/logout", "staff sign-out"],
  ["/admin/users", "the admin API"],
  ["/users/directory", "the user directory"],
  ["/quizzes", "the quiz API"],
  ["/contests", "the contest API"],
  ["useCurrentUser needs a signed-in staff session", "the staff session provider"],
];

const files = [...new Set(ENTRIES.flatMap((entry) => pages[entry]).filter((file) => file.endsWith(".js")))];
let bytes = 0;
const leaks = [];
for (const file of files) {
  const path = join(NEXT_DIR, file);
  bytes += statSync(path).size;
  const source = readFileSync(path, "utf8");
  for (const [marker, what] of STAFF_MARKERS) {
    if (source.includes(marker)) leaks.push(`${file} contains ${JSON.stringify(marker)} (${what})`);
  }
}

console.log(`player page ships ${files.length} scripts, ${(bytes / 1024).toFixed(0)} KB (uncompressed)`);
if (leaks.length > 0) {
  console.error("\nStaff code in the player bundle:\n- " + leaks.join("\n- "));
  process.exit(1);
}
console.log("ok   no staff or auth code in the player bundle");
