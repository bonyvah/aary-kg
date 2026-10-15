// Sign in, the route guard, and managing users: create (password shown once), disable, enable, sign out.
import { ADMIN_LOGIN, ADMIN_PASSWORD, BASE, openMenu, page, signIn, unique, waitText } from "./helpers.mjs";

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

  await signIn(p, ADMIN_LOGIN, ADMIN_PASSWORD, "admin");
  t.ok("an admin lands on /admin", true);
  await p.waitForSelector("table");
  t.ok("the admin is not in the user list", (await p.locator("tbody tr", { hasText: ADMIN_LOGIN }).count()) === 0);
  for (const path of ["/dashboard", "/quizzes/new", "/contests/new"]) {
    await p.goto(`${BASE}${path}`);
    await p.waitForURL("**/admin");
  }
  t.ok("an admin is kept off the dashboard, the quiz editor and contest creation", true);

  const tag = unique();
  const login = `ulan.${tag}`;
  const lastName = `Касымов${tag}`;
  await p.getByRole("button", { name: "Создать пользователя" }).click();
  t.ok("there is no role to pick: admins create regular users only", (await p.locator("dialog[open] select").count()) === 0);
  await p.getByLabel("Имя").fill("Улан");
  await p.getByRole("button", { name: "Создать", exact: true }).click();
  await waitText(p, "Заполните поле");
  t.ok("the last name is required too", true);
  await p.getByLabel("Фамилия").fill(lastName);
  await p.locator("dialog[open]").getByLabel("Логин", { exact: true }).fill(ADMIN_LOGIN);
  await p.getByRole("button", { name: "Создать", exact: true }).click();
  await waitText(p, "Этот логин занят");
  t.ok("an existing login is refused", true);

  await p.locator("dialog[open]").getByLabel("Логин", { exact: true }).fill(login);
  await p.getByRole("button", { name: "Создать", exact: true }).click();
  await waitText(p, "Временный пароль");
  const dialog = await p.locator("dialog[open]").innerText();
  const password = dialog.match(/[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}/)?.[0];
  t.ok("the new user's password is shown once", Boolean(password), password ?? "");
  await p.getByRole("button", { name: "Готово" }).click();

  const row = p.locator("tbody tr", { hasText: lastName });
  t.ok("the list shows first name, then last name", (await row.innerText()).includes(`Улан ${lastName}`));
  await row.getByRole("button", { name: "Отключить" }).click();
  await p.getByRole("button", { name: "Отключить", exact: true }).last().click();
  await waitText(p, "Пользователь отключён");
  t.ok("a user can be disabled", (await row.innerText()).includes("Отключён"));
  await row.getByRole("button", { name: "Включить" }).click();
  await waitText(p, "Пользователь включён");
  t.ok("and enabled again", (await row.innerText()).includes("Активен"));
  t.ok("a user row has no avatar or initial circle", (await row.locator("td").first().locator("[class*=size-10]").count()) === 0);

  // the new user can sign in; the reset password ends that session
  const user = await page(browser, t, "new user");
  await signIn(user, login, password);
  t.ok("the new user signs in with the generated password", true);
  await user.goto(`${BASE}/admin`);
  await user.waitForURL("**/dashboard");
  t.ok("a non-admin is sent away from /admin", true);

  // account settings: the user changes their own password and login
  const menu = async () => {
    await openMenu(user);
    await user.locator("dialog[open]").waitFor();
  };
  await menu();
  await user.getByRole("button", { name: "Сменить пароль" }).click();
  const fillPasswords = async (current, next) => {
    const dialog = user.locator("dialog[open]");
    await dialog.getByLabel("Текущий пароль", { exact: true }).fill(current);
    await dialog.getByLabel("Новый пароль", { exact: true }).fill(next);
    await dialog.getByLabel("Повторите новый пароль", { exact: true }).fill(next);
    await user.getByRole("button", { name: "Сохранить" }).click();
  };
  await fillPasswords(password, "short1");
  await waitText(user, "Пароль короче 8 символов");
  await fillPasswords(password, "onlyletters");
  await waitText(user, "хотя бы одну цифру");
  await fillPasswords(password, "Ulan-2026-ok");
  await waitText(user, "не должно быть вашего имени");
  t.ok("a password with the first name in Latin letters is refused", true);
  await fillPasswords(password, `kasimov${tag}-1x`);
  await waitText(user, "не должно быть вашего имени");
  t.ok("so is one with the last name spelled differently", true);
  await fillPasswords("not-the-password-1", "tulpar-9421-x");
  await waitText(user, "Текущий пароль неверный");
  t.ok("a wrong current password is refused", true);
  await fillPasswords(password, "tulpar-9421-x");
  await waitText(user, "Пароль изменён");
  t.ok("a good password is accepted and this session carries on", (await user.getByRole("button", { name: "Создать" }).count()) === 0);
  await user.reload();
  await user.waitForURL("**/dashboard");

  await menu();
  await user.getByRole("button", { name: "Сменить логин" }).click();
  const newLogin = `ulan2.${tag}`;
  await user.locator("dialog[open]").getByLabel("Логин", { exact: true }).fill(newLogin);
  await user.locator("dialog[open]").getByLabel("Текущий пароль", { exact: true }).fill("tulpar-9421-x");
  await user.getByRole("button", { name: "Сохранить" }).click();
  await waitText(user, "Логин изменён");
  await menu();
  t.ok("the settings show the new login", (await user.locator("dialog[open]").innerText()).includes(newLogin));
  await user.keyboard.press("Escape");
  const other = await page(browser, t, "same user");
  await signIn(other, newLogin, "tulpar-9421-x");
  t.ok("signing in works with the new login and password", true);
  await other.context().close();

  await row.getByRole("button", { name: "Сбросить пароль" }).click();
  await p.getByRole("button", { name: "Сбросить", exact: true }).click();
  await waitText(p, "Временный пароль");
  await p.getByRole("button", { name: "Готово" }).click();
  await user.reload();
  await user.waitForURL("**/login");
  t.ok("resetting a password ends that user's open session", true);

  await p.reload();
  await p.waitForSelector("table");
  await openMenu(p);
  await p.getByRole("button", { name: "Выйти" }).click();
  await p.waitForURL("**/login");
  await p.goto(`${BASE}/dashboard`);
  await p.waitForURL("**/login");
  t.ok("signing out ends the session", true);
}
