import { expect, test, type APIRequestContext } from "@playwright/test";
import { addDays, isSunday, todayISO, weekStart } from "../../shared/dates";

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

test("Resumo: link na semana, domingo com cartão; semana anterior; levar a partir de hoje", async ({ page, request }) => {
  for (const title of ["Feita A", "Feita B", "Feita C"]) await seed(request, { title, date: MON }, true);
  await seed(request, { title: "Feita D", date: TUE }, true);
  await seed(request, { title: "Ligar para o banco", date: TUE, area: "personal" });
  await seed(request, { title: "Estudar Álgebra, cap. 2", date: WED, area: "school" });
  await seed(request, { title: "Atividade de Estatística", date: WED, area: "school" });
  await seed(request, { title: "Feita E (tarde)", date: addDays(START, 5) }, true);
  await seed(request, { title: "Domingo ignorado", date: SUNDAY }); // domingo nunca entra na conta
  // feitas 5, não feitas 3 -> 63%; 5 médias = 125 XP -> Bronze (a semana anterior não tem XP)

  // Relógio real do navegador: o servidor recusa levar tarefas para dias que já passaram.
  const realToday = todayISO();
  const target = isSunday(realToday) ? addDays(realToday, 1) : realToday;
  await page.goto("/");

  await test.step("abre o resumo da semana passada pelo link (ou pelo cartão, no domingo)", async () => {
    if (isSunday(realToday)) {
      // No domingo o cartão abre a revelação da medalha; dela se chega ao resumo.
      await page.getByRole("button", { name: /Sua semana fechou/ }).click();
      await page.getByRole("dialog", { name: "Medalha da semana" }).getByRole("button", { name: "Ver detalhes da semana" }).click();
      await page.getByRole("dialog", { name: "Resumo da semana" }).getByRole("button", { name: "Semana anterior" }).click();
    } else {
      await expect(page.getByRole("button", { name: /Sua semana fechou/ })).toHaveCount(0);
      await page.getByRole("button", { name: /^Resumo da semana/ }).click();
    }
    const report = page.getByRole("dialog", { name: "Resumo da semana" });
    const numbers = report.getByTestId("report-numbers");
    await expect(numbers).toContainText("5");
    await expect(numbers).toContainText("feitas");
    await expect(numbers).toContainText("3");
    await expect(numbers).toContainText("não feitas");
    await expect(numbers).toContainText("63%");
    const xp = report.getByTestId("report-xp");
    await expect(xp.getByRole("heading", { name: "Semana Bronze · 125 XP" })).toBeVisible();
    await expect(xp.getByRole("img", { name: "Medalha Bronze" })).toBeVisible();
    await expect(xp).toContainText("+125 XP vs semana passada");
    await expect(report.getByTestId("report-level").getByRole("progressbar", { name: /^Nível \d+/ })).toBeVisible();
    await expect(report.getByTestId("report-next")).toHaveCount(0); // semana passada: sem "faltam"
    await expect(xp.getByRole("listitem").filter({ hasText: "Média" })).toContainText("5 feitas · 125 XP");
    await expect(xp.getByRole("listitem").filter({ hasText: "Alta" })).toContainText("0 feitas · 0 XP");
    await expect(report.getByRole("listitem").filter({ hasText: /^(seg|ter|qua|qui|sex|sáb|dom)$/ })).toHaveCount(6);
    await expect(report.getByRole("listitem", { name: /^dom/ })).toHaveCount(0);
    await expect(report.getByText("Não feitas (3)")).toBeVisible();
    await expect(report.getByText("Domingo ignorado")).toHaveCount(0);
    await expect(report.getByText("Estudar Álgebra, cap. 2")).toBeVisible();
    await page.screenshot({ path: "test-results/report-390x844.png" });
  });

  await test.step("levar uma não feita para hoje (ou segunda, no domingo), uma única vez", async () => {
    const report = page.getByRole("dialog", { name: "Resumo da semana" });
    const row = report.getByRole("listitem").filter({ hasText: "Ligar para o banco" });
    await row.getByRole("button", { name: /^Levar .* para esta semana$/ }).dblclick();
    await expect(page.getByText(/^Levada para (hoje|amanhã)/)).toBeVisible();
    await expect(row.getByText("Levada")).toBeVisible();
    await expect(row.getByRole("button", { name: /para esta semana/ })).toHaveCount(0);
    await expect(report.getByText("Não feitas (3)")).toBeVisible();
    const week = await (await request.get(`/api/week?start=${weekStart(target)}`)).json();
    const copies = week.tasks.filter((t: { title: string }) => t.title === "Ligar para o banco");
    expect(copies).toHaveLength(1);
    expect(copies[0].date).toBe(target);
    expect(copies[0].movedFromId).toBeTruthy();
    // recarregar o resumo mantém "levada ✓" e o servidor recusa uma segunda cópia
    expect((await request.post(`/api/tasks/${copies[0].movedFromId}/move`, { data: { date: target } })).status()).toBe(409);
  });

  await test.step("semana anterior e próxima", async () => {
    const report = page.getByRole("dialog", { name: "Resumo da semana" });
    await report.getByRole("button", { name: "Semana anterior" }).click();
    await expect(report.getByTestId("report-numbers")).toContainText("—");
    await report.getByRole("button", { name: "Próxima" }).click();
    await expect(report.getByTestId("report-numbers")).toContainText("63%");
    await report.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
