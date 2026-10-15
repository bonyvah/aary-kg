// A quiz in the editor, then a whole contest: create, open, two jury members score, close, results.
import { BASE, api, createUser, page, signIn, unique, waitText } from "./helpers.mjs";

export default async function run(browser, t) {
  const tag = unique();
  // The owner is a regular user: admins do not create quizzes or contests.
  const owner = await createUser(browser, t, `owner.${tag}`, `Организатор ${tag}`);
  const admin = await page(browser, t, "owner");
  await signIn(admin, owner.login, owner.password);

  // jury members
  const make = async (login, name) => (await createUser(browser, t, login, name)).password;
  const omur = { login: `omur.${tag}`, name: `Өмүр ${tag}` };
  const gulzat = { login: `gulzat.${tag}`, name: `Гүлзат ${tag}` };
  omur.password = await make(omur.login, omur.name);
  gulzat.password = await make(gulzat.login, gulzat.name);

  // --- quiz editor ---
  await admin.goto(`${BASE}/quizzes/manage/new`);
  await admin.getByRole("button", { name: "Сохранить" }).click();
  await waitText(admin, "Заполните пустые поля");
  t.ok("an empty quiz is not sent (fields are marked)", true);
  await admin.getByLabel("Название викторины").fill(`География ${tag}`);
  await admin.getByLabel("Вопрос", { exact: true }).fill("Столица Кыргызстана?");
  const shapes = ["Красный треугольник", "Синий ромб", "Жёлтый круг", "Зелёный квадрат"];
  for (const [i, answer] of ["Ош", "Бишкек", "Нарын", "Каракол"].entries()) await admin.getByLabel(`Ответ: ${shapes[i]}`).fill(answer);
  await admin.getByRole("radio", { name: /Синий ромб/ }).click();
  await admin.getByRole("button", { name: "Сохранить" }).click();
  await admin.waitForURL(/\/dashboard/);
  t.ok("saving a quiz returns to the dashboard", true, admin.url());
  await admin.getByRole("link", { name: `География ${tag}` }).click();
  await admin.waitForURL(/\/quizzes\/view\/[0-9a-f-]{36}/);
  await admin.getByRole("link", { name: "Редактировать" }).click();
  await admin.getByLabel("Название викторины").waitFor();
  await admin.waitForTimeout(500);
  t.ok("the saved quiz opens again for editing", (await admin.getByLabel("Название викторины").inputValue()) === `География ${tag}`);

  // --- contest form: weights must add up to 100 ---
  await admin.goto(`${BASE}/contests/new`);
  const title = `Конкурс чтецов ${tag}`;
  await admin.getByLabel("Название конкурса").fill(title);
  await admin.getByLabel("Название критерия").first().fill("Выразительность");
  await admin.getByLabel("Вес, %").first().fill("60");
  await admin.getByRole("button", { name: "Добавить критерий" }).click();
  await admin.getByLabel("Название критерия").nth(1).fill("Дикция");
  await admin.getByLabel("Вес, %").nth(1).fill("30");
  await admin.getByLabel("Имя", { exact: true }).first().fill("Айдана");
  await admin.getByRole("button", { name: "Добавить участника" }).click();
  await admin.getByLabel("Имя", { exact: true }).nth(1).fill("Бекболот");
  await admin.getByRole("button", { name: "Сохранить" }).click();
  await waitText(admin, "Конкурс не сохранён");
  t.ok("weights of 90 and no jury are refused", true);
  await admin.getByLabel("Вес, %").nth(1).fill("40");
  await admin.getByText(omur.name).click();
  await admin.getByText(gulzat.name).click();
  await admin.getByRole("button", { name: "Сохранить" }).click();
  await admin.waitForURL(/\/contests\/[0-9a-f-]{36}$/);
  const contestId = admin.url().split("/").pop();
  await waitText(admin, "Организатор");
  await admin.getByRole("button", { name: "Начать оценку" }).click();
  await admin.getByRole("button", { name: "Начать", exact: true }).click();
  await waitText(admin, "Оценка началась");
  t.ok("the contest is saved and opened for scoring", true);

  // --- jury ---
  async function score(who, picks) {
    const p = await page(browser, t, who.login);
    await signIn(p, who.login, who.password);
    await p.goto(`${BASE}/contests/${contestId}/score`);
    await waitText(p, "Участник 1 из 2");
    for (let entry = 0; entry < 2; entry += 1) {
      for (let criterion = 0; criterion < 2; criterion += 1) {
        await p.getByRole("radiogroup").nth(criterion).getByRole("radio").nth(picks[entry][criterion] - 1).click();
      }
      if (entry === 0) await p.getByRole("button", { name: "Далее" }).click();
    }
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Завершить оценку" }).click();
    await waitText(p, "Оценка завершена");
    return p;
  }
  const first = await score(omur, [[5, 4], [3, 3]]);
  await first.reload();
  await waitText(first, "Оценено: 2 из 2");
  t.ok("a jury member's scores are saved on the server (they survive a reload)", true);
  await score(gulzat, [[4, 5], [5, 5]]);

  // --- close and read the results ---
  await admin.reload();
  await waitText(admin, "Закончил");
  const mine = await api(admin, "GET", `/contests/${contestId}`);
  t.ok("the owner's copy of the contest holds nobody's scores", JSON.stringify(mine.body.scores) === "{}");
  await admin.getByRole("button", { name: "Закрыть конкурс" }).click();
  await admin.getByRole("button", { name: "Закрыть", exact: true }).click();
  await waitText(admin, "Конкурс закрыт");
  await admin.goto(`${BASE}/contests/${contestId}/results`);
  await waitText(admin, "Итоговая оценка");
  const rows = await admin.locator("tbody tr").allInnerTexts();
  // entry 1: (5*.6 + 4*.4 = 4.6 and 4*.6 + 5*.4 = 4.4) -> 4.50; entry 2: (3 and 5) -> 4.00
  t.ok("the ranking is 4,50 then 4,00", /4,50/.test(rows[0]) && /4,00/.test(rows[1]), rows[0].replace(/\s+/g, " "));
  await admin.getByRole("button", { name: "Оценки" }).first().click();
  await waitText(admin, "Член жюри");
  t.ok("the owner sees who scored what", (await admin.locator("dialog[open]").innerText()).includes(gulzat.name));
  await first.goto(`${BASE}/contests/${contestId}/results`);
  await waitText(first, "Итоговая оценка");
  t.ok("a jury member sees the ranking but not the breakdown", (await first.getByRole("button", { name: "Оценки" }).count()) === 0);
  await first.goto(`${BASE}/contests/${contestId}/score`);
  await waitText(first, "Вы не можете оценивать этот конкурс");
  t.ok("scoring a closed contest says no access", true);
}
