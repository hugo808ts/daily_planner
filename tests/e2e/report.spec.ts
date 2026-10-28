import { expect, test, type APIRequestContext } from "@playwright/test";
import { addDays, todayISO, weekStart } from "../../shared/dates";

// Semana passada (segunda a sábado) em relação ao relógio real do servidor, para que todas
// as tarefas dela já tenham passado dos dois lados. O relógio do navegador vai para o domingo
// seguinte a ela.
const START = addDays(weekStart(todayISO()), -7);
const SUNDAY = addDays(START, 6);
const MON = START;
const TUE = addDays(START, 1);
const WED = addDays(START, 2);

async function seed(request: APIRequestContext, input: { title: string; date: string; area?: string }, done = false) {
  const res = await request.post("/api/tasks", { data: input });
  expect(res.status()).toBe(201);
  const { task } = await res.json();
  if (done) expect((await request.patch(`/api/tasks/${task.id}`, { data: { done: true } })).ok()).toBe(true);
  return task;
}

test("Domingo: cartão leva ao resumo seg–sáb; semana anterior; levar para segunda", async ({ page, request }) => {
  for (const title of ["Feita A", "Feita B", "Feita C"]) await seed(request, { title, date: MON }, true);
  await seed(request, { title: "Feita D", date: TUE }, true);
  await seed(request, { title: "Ligar para o banco", date: TUE, area: "personal" });
  await seed(request, { title: "Estudar Cálculo, cap. 4", date: WED, area: "school" });
  await seed(request, { title: "Atividade de Estatística", date: WED, area: "school" });
  await seed(request, { title: "Feita E (tarde)", date: addDays(START, 5) }, true);
  await seed(request, { title: "Domingo ignorado", date: SUNDAY }); // domingo nunca entra na conta
  // feitas 5, não feitas 3 -> 63%

  await test.step("fora do domingo não há cartão", async () => {
    await page.clock.install({ time: new Date(`${WED}T15:00:00-03:00`) });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
    await expect(page.getByText("Sua semana fechou")).toHaveCount(0);
  });

  await page.clock.setFixedTime(new Date(`${SUNDAY}T09:00:00-03:00`));
  await page.reload();

  await test.step("cartão no domingo abre o resumo com os números certos", async () => {
    await page.getByRole("button", { name: /Sua semana fechou/ }).click();
    const report = page.getByRole("dialog", { name: "Resumo da semana" });
    const numbers = report.getByTestId("report-numbers");
    await expect(numbers).toContainText("5");
    await expect(numbers).toContainText("feitas");
    await expect(numbers).toContainText("3");
    await expect(numbers).toContainText("não feitas");
    await expect(numbers).toContainText("63%");
    await expect(report.getByRole("listitem").filter({ hasText: /^(seg|ter|qua|qui|sex|sáb|dom)$/ })).toHaveCount(6);
    await expect(report.getByRole("listitem", { name: /^dom/ })).toHaveCount(0);
    await expect(report.getByText("Não feitas (3)")).toBeVisible();
    await expect(report.getByText("Domingo ignorado")).toHaveCount(0);
    await expect(report.getByText("Estudar Cálculo, cap. 4")).toBeVisible();
    await expect(report.getByRole("button", { name: "próxima ›" })).toHaveCount(0); // já é a semana atual
    await page.screenshot({ path: "test-results/report-390x844.png" });
  });

  await test.step("levar uma não feita para a segunda", async () => {
    const report = page.getByRole("dialog", { name: "Resumo da semana" });
    await report.getByRole("listitem").filter({ hasText: "Ligar para o banco" }).getByRole("button", { name: "→ esta semana" }).click();
    await expect(page.getByText("Levada para segunda")).toBeVisible();
    await expect(report.getByText("Não feitas (2)")).toBeVisible();
    const week = await (await request.get(`/api/week?start=${addDays(START, 7)}`)).json();
    const copy = week.tasks.find((t: { title: string }) => t.title === "Ligar para o banco");
    expect(copy.date).toBe(addDays(START, 7));
    expect(copy.movedFromId).toBeTruthy();
  });

  await test.step("semana anterior e próxima", async () => {
    const report = page.getByRole("dialog", { name: "Resumo da semana" });
    await report.getByRole("button", { name: "‹ semana anterior" }).click();
    await expect(report.getByTestId("report-numbers")).toContainText("0%");
    await report.getByRole("button", { name: "próxima ›" }).click();
    await expect(report.getByTestId("report-numbers")).toContainText("63%");
    await report.getByRole("button", { name: "‹ voltar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
