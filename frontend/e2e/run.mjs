// Runs every browser test in turn against a running stack. See README.md.
import { launch, requireAdmin, Report } from "./helpers.mjs";

requireAdmin();
const only = process.argv[2];
const suites = ["admin", "contest", "game"].filter((name) => !only || name === only);

const browser = await launch();
let failed = 0;
for (const name of suites) {
  const report = new Report(name);
  try {
    await (await import(`./${name}.e2e.mjs`)).default(browser, report);
  } catch (error) {
    report.failed += 1;
    console.log(`FAIL ${name} stopped: ${error.message.split("\n")[0]}`);
  }
  if (report.errors.length > 0) {
    report.failed += 1;
    console.log("FAIL unexpected browser errors:\n  " + report.errors.join("\n  "));
  }
  failed += report.failed;
}
await browser.close();
console.log(failed === 0 ? "\nALL OK" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
