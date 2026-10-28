import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Relógio do navegador fixo numa quarta-feira, 15h em São Paulo. O servidor usa a hora
// real, mas para ele as datas abaixo já ficaram no passado, então "ontem" é não feita
// nos dois lados.
const NOW = new Date("2026-10-28T15:00:00-03:00");
const TODAY = "2026-10-28"; // qua
const YESTERDAY = "2026-10-27"; // ter
const TOMORROW = "2026-10-29"; // qui

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

const row = (page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

test("Hoje: placar, atrasadas, troca de dia, levar para outro dia e anotação", async ({ page, request }) => {
  await seed(request, { title: "Responder e-mail do fornecedor", date: TODAY, area: "work" }, true);
  await seed(request, { title: "Estudar Cálculo, cap. 4", date: TODAY, time: "14:00", area: "school" });
  await seed(request, { title: "Jantar com a namorada", date: TODAY, time: "20:00", area: "personal" });
  await seed(request, { title: "Entregar atividade de Estatística", date: YESTERDAY, time: "18:00", area: "school" });
  await seed(request, { title: "Reunião de equipe", date: TOMORROW, time: "10:00", area: "work" });

  await page.clock.install({ time: NOW });
  await page.goto("/");

  await test.step("faixa da semana seg–dom com hoje destacado", async () => {
    const week = page.getByRole("navigation", { name: "Dias da semana" });
    const days = week.getByRole("button");
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText("seg");
    await expect(days.first()).toContainText("26");
    await expect(days.last()).toContainText("dom");
    await expect(days.last()).toContainText("1");
    const today = week.locator('[aria-current="date"]');
    await expect(today).toHaveCount(1);
    await expect(today).toContainText("qua");
    await expect(today).toContainText("28");
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
    await page.getByRole("button", { name: /qui.*29/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Amanhã");
    await expect(row(page, "Reunião de equipe")).toBeVisible();
    await expect(row(page, "Jantar com a namorada")).toHaveCount(0);
  });

  await test.step("levar tarefa não feita de ontem para sexta cria cópia 'veio de ter'", async () => {
    await page.getByRole("button", { name: /ter.*27/ }).click();
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
    await sheet.getByRole("button", { name: "sex 30" }).click();
    await expect(sheet).toBeHidden();

    await expect(row(page, "Entregar atividade de Estatística")).toHaveAttribute("data-status", "not_done");
    await page.getByRole("button", { name: /sex.*30/ }).click();
    const copy = row(page, "Entregar atividade de Estatística");
    await expect(copy).toHaveAttribute("data-status", "pending");
    await expect(copy).toContainText("veio de ter");
  });

  await test.step("anotação do dia é salva", async () => {
    await page.getByRole("button", { name: /qua.*28/ }).click();
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

  await page.screenshot({ path: "test-results/today-390x844.png" });
});
