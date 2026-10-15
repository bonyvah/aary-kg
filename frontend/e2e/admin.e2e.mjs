// Sign in, the route guard, and managing users: create (password shown once), disable, enable, sign out.
import { ADMIN_LOGIN, ADMIN_PASSWORD, BASE, page, signIn, unique, waitText } from "./helpers.mjs";

export default async function run(browser, t) {
  const p = await page(browser, t, "admin");
  await p.goto(`${BASE}/admin`);
  await p.waitForURL("**/login");
  t.ok("a signed-out visitor is sent to /login", true);

  await p.fill("input[autocomplete=username]", ADMIN_LOGIN);
  await p.fill("input[type=password]", `${ADMIN_PASSWORD}-wrong`);
  await p.click("button[type=submit]");
  await waitText(p, "Неверный логин или пароль");
  t.ok("a wrong password is refused with a message", true);

  await signIn(p, ADMIN_LOGIN, ADMIN_PASSWORD);
  await p.goto(`${BASE}/admin`);
  await p.waitForSelector("table");

  const login = `ulan.${unique()}`;
  await p.getByRole("button", { name: "Создать пользователя" }).click();
  await p.getByLabel("Имя").fill("Улан Касымов");
  await p.getByLabel("Логин").fill(ADMIN_LOGIN);
  await p.getByRole("button", { name: "Создать", exact: true }).click();
  await waitText(p, "Этот логин занят");
  t.ok("an existing login is refused", true);

  await p.getByLabel("Логин").fill(login);
  await p.getByRole("button", { name: "Создать", exact: true }).click();
  await waitText(p, "Временный пароль");
  const dialog = await p.locator("dialog[open]").innerText();
  const password = dialog.match(/[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}/)?.[0];
  t.ok("the new user's password is shown once", Boolean(password), password ?? "");
  await p.getByRole("button", { name: "Готово" }).click();

  const row = p.locator("tbody tr", { hasText: login });
  await row.getByRole("button", { name: "Отключить" }).click();
  await p.getByRole("button", { name: "Отключить", exact: true }).last().click();
  await waitText(p, "Пользователь отключён");
  t.ok("a user can be disabled", (await row.innerText()).includes("Отключён"));
  await row.getByRole("button", { name: "Включить" }).click();
  await waitText(p, "Пользователь включён");
  t.ok("and enabled again", (await row.innerText()).includes("Активен"));
  const self = p.locator("tbody tr", { hasText: ADMIN_LOGIN }).first();
  t.ok("an admin cannot disable themselves", await self.getByRole("button", { name: "Отключить" }).isDisabled());

  // the new user can sign in; the reset password ends that session
  const user = await page(browser, t, "new user");
  await signIn(user, login, password);
  t.ok("the new user signs in with the generated password", true);
  await user.goto(`${BASE}/admin`);
  await user.waitForURL("**/dashboard");
  t.ok("a non-admin is sent away from /admin", true);
  await row.getByRole("button", { name: "Сбросить пароль" }).click();
  await p.getByRole("button", { name: "Сбросить", exact: true }).click();
  await waitText(p, "Временный пароль");
  await p.getByRole("button", { name: "Готово" }).click();
  await user.reload();
  await user.waitForURL("**/login");
  t.ok("resetting a password ends that user's open session", true);

  await p.reload();
  await p.waitForSelector("table");
  await p.getByRole("button", { name: "Открыть меню" }).click();
  await p.getByRole("button", { name: "Выйти" }).click();
  await p.waitForURL("**/login");
  await p.goto(`${BASE}/dashboard`);
  await p.waitForURL("**/login");
  t.ok("signing out ends the session", true);
}
