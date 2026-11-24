import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays } from "../../shared/dates";

// Dia próprio no futuro (relógio falso no navegador e X-Test-Today no servidor), longe dos outros specs.
// As tarefas são criadas agora (data real), então "na lista há N dias" aparece.
const TODAY = "2030-07-17";
const TOMORROW = addDays(TODAY, 1);
const SHOTS = process.env.SHOTS_DIR ?? "test-results";

const created: string[] = [];

async function open(page: Page, day: string) {
  await page.clock.install({ time: new Date(`${day}T10:00:00-03:00`) });
  await page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-test-today": day } }));
  await page.goto("/#hoje");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
}

async function seed(request: APIRequestContext, data: Record<string, unknown>) {
  const res = await request.post("/api/tasks", { data });
  expect(res.status()).toBe(201);
  const { task } = await res.json();
  created.push(task.id);
  return task;
}

const list = (page: Page) => page.getByRole("region", { name: "A fazer" });
const row = (page: Page, title: string) => list(page).getByRole("listitem").filter({ hasText: title });

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ request }) => {
  const { undated } = await (await request.get(`/api/todo?date=${TODAY}`)).json();
  for (const t of undated) if (/Afazer/.test(t.title) && !created.includes(t.id)) created.push(t.id);
  for (const id of created) await request.delete(`/api/tasks/${id}`);
});

test("A fazer: captura sem dia vai para a lista, marcar dá XP hoje, compromisso em destaque", async ({ page, request }) => {
  await seed(request, { title: "Comprar presente Afazer", area: "personal", difficulty: "low" });
  await seed(request, { title: "Dentista Afazer", date: TODAY, time: "15:00", area: "personal" });
  await seed(request, { title: "Amanhã Afazer", date: TOMORROW });
  await open(page, TODAY);

  await test.step("compromisso de hoje em destaque com a hora; o de amanhã não aparece", async () => {
    const appt = row(page, "Dentista Afazer");
    await expect(appt).toHaveAttribute("data-appointment", "true");
    await expect(appt).toContainText("hoje · 15:00");
    await expect(row(page, "Amanhã Afazer")).toHaveCount(0);
    await expect(row(page, "Comprar presente Afazer").getByTestId("task-age")).toHaveText(/^na lista há \d+ dias$/);
  });

  await test.step("frase sem dia: a folha vem em Sem data e a tarefa entra na lista", async () => {
    await page.getByRole("textbox", { name: "Captura rápida" }).fill("estudar cálculo capítulo 4 Afazer");
    await page.getByRole("button", { name: "Enviar" }).click();
    const sheet = page.getByRole("dialog", { name: "Confirmar captura" });
    await expect(sheet.getByRole("radio", { name: "Sem data" })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByRole("button", { name: /^Dia:/ })).toHaveCount(0);
    await expect(sheet).toContainText("Fica na lista até você marcar.");
    await sheet.getByRole("button", { name: /^Pôr na lista · \d+ XP$/ }).click();
    await expect(sheet).toBeHidden();
    await expect(row(page, "Estudar cálculo capítulo 4 Afazer")).toBeVisible();
    const { undated } = await (await request.get(`/api/todo?date=${TODAY}`)).json();
    expect(undated.find((t: { title: string }) => t.title === "Estudar cálculo capítulo 4 Afazer")).toMatchObject({ date: null });
  });

  await test.step("marcar risca a tarefa e soma o XP no topo", async () => {
    await expect(page.getByTestId("day-xp")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Marcar como feita: Comprar presente Afazer" }).click();
    const done = row(page, "Comprar presente Afazer");
    await expect(done).toHaveAttribute("data-status", "done");
    await expect(done.getByTestId("task-xp")).toHaveText("+10 XP");
    await expect(page.getByTestId("day-xp")).toHaveText("+10 XP hoje");
    await page.reload();
    await expect(row(page, "Comprar presente Afazer")).toHaveAttribute("data-status", "done");
    await expect(page.getByTestId("day-xp")).toHaveText("+10 XP hoje");
  });

  await page.waitForTimeout(1000); // XpPop some
  await page.screenshot({ path: `${SHOTS}/afazer-hoje.png`, animations: "disabled", scale: "css" });
});

test("A fazer: no dia seguinte a pendente continua e a feita sai", async ({ page }) => {
  await open(page, TOMORROW);
  await expect(row(page, "Estudar cálculo capítulo 4 Afazer")).toHaveAttribute("data-status", "pending");
  await expect(row(page, "Comprar presente Afazer")).toHaveCount(0);
  // Compromisso de ontem não feito continua na lista, em vermelho.
  await expect(row(page, "Dentista Afazer")).toHaveAttribute("data-status", "not_done");
  await expect(row(page, "Amanhã Afazer")).toHaveAttribute("data-appointment", "true");
  await expect(page.getByTestId("day-xp")).toHaveCount(0);
});
