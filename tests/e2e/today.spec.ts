import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays, todayISO, weekStart } from "../../shared/dates";
import { dayNumber, shortDay } from "../../src/lib/format";

// Relógio do navegador fixo na quarta-feira da semana PASSADA (em relação à data real de
// São Paulo), às 15h. O servidor usa a hora real, então para ele todas as datas abaixo já
// passaram: "ontem" é não feita nos dois lados, em qualquer dia em que o teste rodar.
const TODAY = addDays(weekStart(todayISO()), -5); // qua da semana passada
const NOW = new Date(`${TODAY}T15:00:00-03:00`);
const YESTERDAY = addDays(TODAY, -1); // ter
const TOMORROW = addDays(TODAY, 1); // qui
const FRIDAY = addDays(TODAY, 2); // sex
const MONDAY = addDays(TODAY, -2);
const SUNDAY = addDays(TODAY, 4);
const dayButton = (page: Page, weekday: string) =>
  page.getByRole("navigation", { name: "Dias da semana" }).getByRole("button", { name: new RegExp(`^${weekday}`) });

type Seed = { title: string; date: string; time?: string; area?: string };

async function seed(request: APIRequestContext, input: Seed, done = false) {
  const res = await request.post("/api/tasks", { data: input });
  expect(res.status()).toBe(201);
  const { task } = await res.json();
  if (done) {
    const patch = await request.patch(`/api/tasks/${task.id}`, { data: { done: true } });
    expect(patch.ok()).toBe(true);
  }
  return task;
}

/** O servidor usa o dia do relógio falso do navegador (só em DEV local) ao validar "levar para outro dia". */
const fakeServerToday = (page: Page) =>
  page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-test-today": TODAY } }));

const row = (page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

test("Hoje: placar, atrasadas, troca de dia, levar para outro dia e anotação", async ({ page, request }) => {
  await seed(request, { title: "Responder e-mail do fornecedor", date: TODAY, area: "work" }, true);
  await seed(request, { title: "Estudar Cálculo, cap. 4", date: TODAY, time: "14:00", area: "school" });
  await seed(request, { title: "Jantar com a namorada", date: TODAY, time: "20:00", area: "personal" });
  await seed(request, { title: "Entregar atividade de Estatística", date: YESTERDAY, time: "18:00", area: "school" });
  await seed(request, { title: "Reunião de equipe", date: TOMORROW, time: "10:00", area: "work" });

  await page.clock.install({ time: NOW });
  await fakeServerToday(page);
  await page.goto("/");

  await test.step("faixa da semana seg–dom com hoje destacado", async () => {
    const week = page.getByRole("navigation", { name: "Dias da semana" });
    const days = week.getByRole("button");
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText("seg");
    await expect(days.first()).toContainText(String(dayNumber(MONDAY)));
    await expect(days.last()).toContainText("dom");
    await expect(days.last()).toContainText(String(dayNumber(SUNDAY)));
    const today = week.locator('[aria-current="date"]');
    await expect(today).toHaveCount(1);
    await expect(today).toContainText("qua");
    await expect(today).toContainText(String(dayNumber(TODAY)));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
  });

  await test.step("tarefa com horário passado fica vermelha", async () => {
    const late = row(page, "Estudar Cálculo, cap. 4");
    await expect(late).toHaveAttribute("data-status", "overdue");
    await expect(late).toContainText("passou do horário");
    await expect(row(page, "Jantar com a namorada")).toHaveAttribute("data-status", "pending");
    await expect(page.getByTestId("score")).toHaveText("1 feita · 1 atrasada");
  });

  await test.step("marcar como feita tira o vermelho e atualiza o placar", async () => {
    await page.getByRole("checkbox", { name: "Marcar como feita: Estudar Cálculo, cap. 4" }).click();
    const late = row(page, "Estudar Cálculo, cap. 4");
    await expect(late).toHaveAttribute("data-status", "done");
    await expect(late).not.toContainText("passou do horário");
    await expect(page.getByTestId("score")).toHaveText("2 feitas");
  });

  await test.step("tocar em outro dia mostra as tarefas dele", async () => {
    await dayButton(page, "qui").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Amanhã");
    await expect(row(page, "Reunião de equipe")).toBeVisible();
    await expect(row(page, "Jantar com a namorada")).toHaveCount(0);
  });

  await test.step("levar tarefa não feita de ontem para sexta cria cópia 'veio de ter'", async () => {
    await dayButton(page, "ter").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ontem");
    const missed = row(page, "Entregar atividade de Estatística");
    await expect(missed).toHaveAttribute("data-status", "not_done");
    await expect(missed).toContainText("não feita");

    await missed.getByRole("button", { name: /Entregar atividade de Estatística/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // Tarefa não feita: a data não se edita no formulário, só pela ação de levar.
    await expect(sheet.getByLabel("Dia")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Levar para outro dia" }).click();
    await sheet.getByRole("button", { name: shortDay(FRIDAY) }).click();
    await expect(sheet).toBeHidden();

    await expect(row(page, "Entregar atividade de Estatística")).toHaveAttribute("data-status", "not_done");
    await dayButton(page, "sex").click();
    const copy = row(page, "Entregar atividade de Estatística");
    await expect(copy).toHaveAttribute("data-status", "pending");
    await expect(copy).toContainText("veio de ter");
  });

  await test.step("anotação do dia é salva", async () => {
    await dayButton(page, "qua").click();
    await page.getByRole("button", { name: "Fixar uma anotação" }).click();
    await page.getByRole("textbox", { name: "Anotação do dia" }).fill("Levar o carregador do notebook");
    await page.getByRole("button", { name: "Salvar anotação" }).click();
    await expect(page.getByTestId("day-note")).toContainText("Levar o carregador do notebook");
    await page.reload();
    await expect(page.getByTestId("day-note")).toContainText("Levar o carregador do notebook");
  });

  await test.step("o estado é recalculado com o passar do tempo", async () => {
    await expect(row(page, "Jantar com a namorada")).toHaveAttribute("data-status", "pending");
    await page.clock.fastForward("05:01:00"); // 20h01
    await expect(row(page, "Jantar com a namorada")).toHaveAttribute("data-status", "overdue");
  });

  await page.screenshot({ path: "test-results/today-390x844.png", animations: "disabled", scale: "css" });
});

test("Outra data: só leva ao tocar em Mover", async ({ page, request }) => {
  const task = await seed(request, { title: "Comprar presente", date: TOMORROW });
  await page.clock.install({ time: NOW });
  await fakeServerToday(page);
  await page.goto("/");
  await dayButton(page, "qui").click();
  await row(page, "Comprar presente").getByRole("button", { name: /Comprar presente/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Levar para outro dia" }).click();

  const move = sheet.getByRole("button", { name: "Mover", exact: true });
  await expect(move).toBeDisabled();
  await sheet.getByLabel("Outra data").fill(SUNDAY);
  // Escolher a data não move nada ainda.
  await page.waitForTimeout(300);
  await expect(sheet).toBeVisible();
  const before = await (await request.get(`/api/week?start=${weekStart(TODAY)}`)).json();
  expect(before.tasks.find((t: { id: string }) => t.id === task.id)).toMatchObject({ date: TOMORROW });

  await move.click();
  await expect(sheet).toBeHidden();
  // Para o servidor (relógio real) a tarefa já passou, então vira cópia; o importante é ter movido só agora.
  await expect(page.getByRole("status")).toContainText(/(Levada|Cópia criada) para domingo/);
  await dayButton(page, "dom").click();
  await expect(row(page, "Comprar presente")).toBeVisible();
});

test("marcar como feita ignora toques enquanto salva e volta ao estado anterior se falhar", async ({ page, request }) => {
  await seed(request, { title: "Pagar boleto", date: TODAY });
  await page.clock.install({ time: NOW });
  await fakeServerToday(page);

  let patches = 0;
  let fail = false;
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    patches++;
    await new Promise((r) => setTimeout(r, 600));
    if (fail) return route.fulfill({ status: 500, json: { error: "Falhou." } });
    return route.fallback();
  });
  await page.goto("/");

  const box = page.getByRole("checkbox", { name: "Marcar como feita: Pagar boleto" });
  await box.click();
  await box.click(); // segundo toque com o PATCH ainda no ar: ignorado
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => patches).toBe(1);
  await page.waitForTimeout(800);
  expect(patches).toBe(1);
  await expect(box).toHaveAttribute("aria-checked", "true");

  fail = true;
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", "false"); // otimista
  await expect(page.getByRole("status")).toContainText("Falhou.");
  await expect(box).toHaveAttribute("aria-checked", "true"); // volta ao de antes do toque
  expect(patches).toBe(2);
});
