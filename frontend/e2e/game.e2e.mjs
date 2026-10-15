// A live game with a host and phone-sized players: join by link, refused names, kick,
// answers, a refresh in the middle, early close, podium, the saved report and the Games tab.
import { ADMIN_LOGIN, ADMIN_PASSWORD, BASE, PHONE, api, createUser, page, signIn, text, unique, waitText } from "./helpers.mjs";

const SHAPES = ["Красный треугольник", "Синий ромб", "Жёлтый круг", "Зелёный квадрат"];

export default async function run(browser, t) {
  const tag = unique();
  const account = await createUser(browser, t, `host.${tag}`, `Ведущий ${tag}`);
  const host = await page(browser, t, "host");
  await signIn(host, account.login, account.password);
  const question = (n, correct) => ({
    id: `q${n}`,
    text: `Вопрос номер ${n}?`,
    answers: ["Один", "Два", "Три", "Четыре"],
    correct,
    seconds: 20,
  });
  const quiz = (await api(host, "POST", "/quizzes", { title: `Игра ${tag}`, questions: [question(1, 1), question(2, 2), question(3, 3)] })).body;

  await host.goto(`${BASE}/host/${quiz.id}`);
  await waitText(host, "Ждём игроков");
  const pin = (await host.locator("p.text-display-xl").innerText()).replace(/\s/g, "");
  t.ok("the host's lobby shows a 6-digit PIN", /^\d{6}$/.test(pin), pin);

  const names = { aidana: `Айдана ${tag}`, bek: `Бекболот ${tag}`, extra: `Лишний ${tag}` };
  async function join(label, nickname, viaLink = false) {
    const p = await page(browser, t, label, { viewport: PHONE });
    await p.goto(viaLink ? `${BASE}/?pin=${pin}` : `${BASE}/`);
    if (!viaLink) await p.locator("input").first().fill(pin);
    else {
      await p.waitForFunction((value) => document.querySelector("input")?.value === value, pin, { timeout: 5000 }).catch(() => undefined);
      t.ok("the link's PIN fills the join screen", (await p.locator("input").first().inputValue()) === pin);
    }
    await p.getByRole("button", { name: "Войти" }).click();
    await p.getByLabel("Никнейм").fill(nickname);
    await p.getByRole("button", { name: "Войти" }).click();
    return p;
  }
  const p1 = await join("aidana", names.aidana, true);
  await waitText(p1, "Ты в игре");

  const p2 = await page(browser, t, "bek", { viewport: PHONE });
  await p2.goto(`${BASE}/`);
  await p2.locator("input").first().fill("000000");
  await p2.getByRole("button", { name: "Войти" }).click();
  await waitText(p2, "Такой игры нет");
  t.ok("a wrong PIN says there is no such game", true);
  await p2.locator("input").first().fill(pin);
  await p2.getByRole("button", { name: "Войти" }).click();
  await p2.getByLabel("Никнейм").fill("аdmin");
  await p2.getByRole("button", { name: "Войти" }).click();
  await waitText(p2, "от 1 до 20 символов");
  t.ok("a nickname imitating the host is refused", true);
  await p2.getByLabel("Никнейм").fill(names.aidana.toLowerCase());
  await p2.getByRole("button", { name: "Войти" }).click();
  await waitText(p2, "Это имя занято");
  t.ok("a taken nickname is refused, even in another case", true);
  await p2.getByLabel("Никнейм").fill(names.bek);
  await p2.getByRole("button", { name: "Войти" }).click();
  await waitText(p2, "Ты в игре");
  const p3 = await join("extra", names.extra);
  await waitText(p3, "Ты в игре");

  await waitText(host, names.extra);
  t.ok("the host's lobby lists everyone who joined", (await text(host)).includes(names.aidana) && (await text(host)).includes(names.bek));
  await host.getByRole("button", { name: `Убрать игрока ${names.extra}` }).click();
  await waitText(p3, "Ведущий убрал тебя");
  await p3.reload();
  t.ok("a kicked player is told, and a refresh does not bring them back", (await p3.getByText("Ты в игре").count()) === 0);

  // --- play ---
  await host.getByRole("button", { name: "Начать игру" }).click();
  await waitText(p1, "Вопрос номер");
  t.ok("players see the question but none of the answer texts", !(await text(p1)).includes("Четыре"));
  await waitText(host, "Четыре");
  t.ok("the host screen shows the answers", true);
  const number = async (p) => Number((await text(p)).match(/Вопрос номер (\d)/)[1]);
  const asked = [await number(host)];
  const tap = (p, i) => p.getByRole("button", { name: SHAPES[i - 1] }).click();

  await tap(p1, asked[0]); // the right shape for question n is n
  await tap(p2, 4);
  await waitText(p1, "Верно");
  await waitText(p2, "Неверно");
  t.ok("when everyone has answered the question closes by itself", true);
  await host.locator('[aria-label="Правильный ответ"]').first().waitFor({ timeout: 8000 });
  t.ok("the host sees the counts and the right answer", true);
  await p2.reload();
  await waitText(p2, "Неверно");
  t.ok("a refresh on the results screen restores it, with the tap remembered", true);

  await host.getByRole("button", { name: "Продолжить" }).click();
  await waitText(host, "Лидеры");
  await host.getByRole("button", { name: "Продолжить" }).click();
  await waitText(host, "Вопрос номер");
  asked.push(await number(host));
  await tap(p1, asked[1]);
  await p2.reload();
  await waitText(p2, "Вопрос номер");
  await p1.evaluate(() => {
    // as if the player switched to another tab: a hint for the report
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitText(host, "Ответили: 1 из 2");
  await host.getByRole("button", { name: "Продолжить" }).click(); // the host closes it early
  await waitText(p2, "Время вышло");
  t.ok("a player who did not answer sees «time is up»", true);
  await host.getByRole("button", { name: "Продолжить" }).click();
  await host.getByRole("button", { name: "Продолжить" }).click();
  await waitText(host, "Вопрос номер");
  asked.push(await number(host));
  await tap(p1, asked[2]);
  await tap(p2, asked[2]);
  await waitText(p1, "Верно");
  await host.getByRole("button", { name: "Продолжить" }).click();
  await host.getByRole("button", { name: "Продолжить" }).click();
  await waitText(host, "Победитель");
  await waitText(p1, "Победитель");
  t.ok("host and players reach the podium", true);
  t.ok("the questions came in the quiz order", asked.join() === "1,2,3", asked.join());
  t.ok("the winner sees their place", /на 1-м месте/.test(await text(p1)));

  // --- report and the Games tab ---
  await host.getByRole("link", { name: "Открыть отчёт" }).click();
  await host.waitForURL(/\/reports\/[0-9a-f]{32}/);
  await waitText(host, `Игра ${tag}`);
  const gameId = host.url().match(/\/reports\/([0-9a-f]{32})/)[1];
  const report = await text(host);
  t.ok("the report lists both players", report.includes(names.aidana) && report.includes(names.bek));
  t.ok("the tab-switch hint shows up for the player who left the tab", /Переключил вкладку/.test(report));
  await host.goto(`${BASE}/dashboard`);
  await host.getByRole("tab", { name: "Игры" }).click();
  await waitText(host, `Игра ${tag}`);
  t.ok("the Games tab lists the finished game", true);
  await p1.getByRole("button", { name: "Выйти" }).click();
  await p1.locator("input").first().waitFor();
  t.ok("leaving the podium returns to the PIN screen", true);

  // --- an admin corrects the finished game; the host sees it and cannot do the same ---
  const admin = await page(browser, t, "admin");
  await signIn(admin, ADMIN_LOGIN, ADMIN_PASSWORD, "admin");
  await admin.goto(`${BASE}/admin`);
  await admin.getByRole("tab", { name: "Игры" }).click();
  await admin.getByRole("link", { name: `Игра ${tag}` }).click();
  await admin.waitForURL(/\/admin\/games\//);
  await waitText(admin, "Журнал исправлений");
  const row = admin.locator("tbody tr", { hasText: names.aidana });
  await row.getByRole("button", { name: "Изменить", exact: true }).click();
  await admin.getByLabel("Изменить на").fill("100");
  await admin.getByRole("button", { name: "Применить" }).click();
  await waitText(admin, "Сохранено.");
  t.ok("an admin can add points to a player", /правка: \+100/.test(await admin.locator("tbody").innerText()));
  await admin.getByRole("button", { name: "Готово" }).click();
  await waitText(admin, "очки +100");
  t.ok("the correction is in the log", true);

  await host.goto(`${BASE}/reports/${gameId}`);
  await waitText(host, "Администратор исправил данные игры");
  t.ok("the host sees that an admin corrected the game", true);
  const attempt = await api(host, "POST", `/admin/games/${gameId}/players/${gameId}/adjust`, { delta: 1 });
  t.ok("the host cannot edit the game", attempt.status === 403, String(attempt.status));
  const hosting = await api(admin, "POST", "/games", { quizId: quiz.id });
  t.ok("an admin cannot host a game", hosting.status === 403, String(hosting.status));
}
