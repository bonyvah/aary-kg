// Shared pieces of the browser tests. Run them with `pnpm e2e` (see README.md).
import { chromium } from "playwright";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const ADMIN_LOGIN = process.env.E2E_LOGIN;
export const ADMIN_PASSWORD = process.env.E2E_PASSWORD;

export function requireAdmin() {
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    console.error("Set E2E_LOGIN and E2E_PASSWORD to the login of an admin (see frontend/e2e/README.md).");
    process.exit(2);
  }
}

export const launch = () =>
  // E2E_CHROMIUM points at a Chromium you already have; by default Playwright's own is used.
  chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined, args: ["--no-sandbox"] });

/** Collects check results and browser errors for one test file. */
export class Report {
  constructor(name) {
    this.name = name;
    this.failed = 0;
    this.errors = [];
    console.log(`\n== ${name}`);
  }
  ok(what, condition, detail = "") {
    if (!condition) this.failed += 1;
    console.log(`${condition ? "ok  " : "FAIL"} ${what}${detail ? ` -> ${detail}` : ""}`);
  }
}

// Console errors that are expected: signed-out probes (401), refused input (400, 409), deliberate 404s.
const EXPECTED_ERROR = /status of (400|401|403|404|409)\b/;

/** A fresh browser profile (own cookies and sessionStorage), in Russian unless told otherwise. */
export async function page(browser, report, label, { viewport = { width: 1280, height: 800 }, locale = "ru" } = {}) {
  const context = await browser.newContext({ viewport, locale: locale === "ky" ? "ky-KG" : "ru-RU" });
  await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: BASE }]);
  const p = await context.newPage();
  p.on("console", (m) => {
    if (m.type() === "error" && !EXPECTED_ERROR.test(m.text())) report.errors.push(`${label}: ${m.text()}`);
  });
  p.on("pageerror", (e) => report.errors.push(`${label} pageerror: ${e.message}`));
  return p;
}

export const PHONE = { width: 390, height: 844 };
export const text = (p) => p.locator("body").innerText();
export const waitText = (p, t, timeout = 8000) => p.getByText(t, { exact: false }).first().waitFor({ timeout });
export const unique = () => `${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 36).toString(36)}`;

/** Signs in and waits for the start page of the role: /dashboard for users, /admin for admins. */
export async function signIn(p, login, password, landing = "dashboard") {
  await p.goto(`${BASE}/login`);
  await p.fill("input[autocomplete=username]", login);
  await p.fill("input[type=password]", password);
  await p.click("button[type=submit]");
  await p.waitForURL(`**/${landing}`);
}

/** Opens the account menu (the user's name in the top bar). */
export const openMenu = (p) => p.locator("header button").first().click();

let setupAdmin = null;

/**
 * Admins do not create quizzes, contests or games, so those tests run as a regular user the admin
 * creates here. One admin session is kept for the whole run (sign-in attempts are rate limited).
 * Returns the user's login, password and name.
 */
export async function createUser(browser, report, login, name) {
  if (!setupAdmin) {
    setupAdmin = await page(browser, report, "admin (setup)");
    await signIn(setupAdmin, ADMIN_LOGIN, ADMIN_PASSWORD, "admin");
  }
  const [firstName, ...rest] = name.split(" ");
  const created = await api(setupAdmin, "POST", "/admin/users", { login, firstName, lastName: rest.join(" ") || "Тестов" });
  return { login, name, password: created.body.password };
}

/** Calls the API as the signed-in user of this page (same origin, cookies included). */
export async function api(p, method, path, data) {
  const response = await p.request.fetch(`${BASE}/api${path}`, { method, data });
  return { status: response.status(), body: await response.json().catch(() => null) };
}
