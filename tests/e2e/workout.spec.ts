import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays, todayISO, weekStart } from "../../shared/dates";

// Quinta-feira desta semana: o servidor trata como "hoje" via X-Test-Today (só em DEV local).
const THURSDAY = addDays(weekStart(todayISO()), 3);

const fakeServerToday = (page: Page, today: string) =>
  page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-test-today": today } }));

/** O D1 do e2e é um só por execução: cada teste do Treino começa e termina sem treinos nem sessão aberta. */
async function resetWorkout(request: APIRequestContext) {
  const res = await request.get("/api/workout");
  expect(res.ok()).toBe(true);
  const view = await res.json();
  if (view.openSession) await request.delete(`/api/workout/sessions/${view.openSession.id}`);
  for (const t of view.templates) await request.delete(`/api/workout/templates/${t.id}`);
}

test.beforeEach(async ({ request }) => resetWorkout(request));
test.afterEach(async ({ request }) => resetWorkout(request));

test("Treino: montar a semana e ver o treino de hoje", async ({ page }) => {
  await fakeServerToday(page, THURSDAY);
  await page.goto("/#treino");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Treino");
  await expect(page.getByRole("heading", { name: "Monte sua semana" })).toBeVisible();

  const sheet = page.getByRole("dialog");
  await test.step("primeiro uso: abre a montagem e cria o Treino A", async () => {
    await page.getByRole("button", { name: "Montar a semana" }).click();
    await expect(sheet.getByRole("heading", { name: "Montar a semana" })).toBeVisible();
    await expect(sheet.getByRole("radio", { name: /^4/ })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: /Novo treino/ }).click();
    await expect(sheet.getByRole("heading", { name: "Editar Treino A" })).toBeVisible();
    await sheet.getByLabel("Foco").fill("Perna");
    await sheet.getByRole("button", { name: "Salvar nome e foco" }).click();
    await expect(sheet.getByRole("button", { name: "Salvar nome e foco" })).toHaveCount(0);
  });

  await test.step("dois exercícios, com peso em kg e descanso", async () => {
    const add = async (name: string, sets: string, reps: string, kg: string) => {
      await sheet.getByLabel("Exercício", { exact: true }).fill(name);
      await sheet.getByLabel("Séries").fill(sets);
      await sheet.getByLabel("Reps").fill(reps);
      await sheet.getByLabel("Peso kg").fill(kg);
      await sheet.getByRole("button", { name: "Adicionar exercício" }).click();
      await expect(sheet.getByRole("list", { name: "Exercícios do Treino A" }).getByText(name)).toBeVisible();
    };
    await add("Leg press 45°", "4", "12", "180");
    await add("Agachamento livre", "4", "8", "82,5");
    const list = sheet.getByRole("list", { name: "Exercícios do Treino A" }).getByRole("listitem");
    await expect(list).toHaveCount(2);
    await expect(list.nth(1)).toContainText("4 × 8 · 82,5 kg");
    // Agachamento primeiro.
    await sheet.getByRole("button", { name: "Subir Agachamento livre" }).click();
    await expect(list.nth(0)).toContainText("Agachamento livre");
    // Peso inválido não vai para o servidor.
    await sheet.getByLabel("Exercício", { exact: true }).fill("Cadeira extensora");
    await sheet.getByLabel("Peso kg").fill("50,3");
    await sheet.getByRole("button", { name: "Adicionar exercício" }).click();
    await expect(sheet.getByText("Use kg com 0,5 de passo (ex.: 82,5).")).toBeVisible();
    await expect(list).toHaveCount(2);
  });

  await test.step("Treino A na quinta e meta de 5 dias", async () => {
    await sheet.getByRole("button", { name: "Voltar para a semana" }).click();
    await sheet.getByRole("radio", { name: /^5/ }).click();
    await expect(sheet.getByRole("radio", { name: /^5/ })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: "Quinta: folga. Trocar" }).click();
    await sheet.getByRole("radiogroup", { name: "Treino de Quinta" }).getByRole("radio", { name: "Treino A · Perna" }).click();
    await expect(sheet.getByRole("button", { name: "Quinta: Treino A. Trocar" })).toBeVisible();
    await sheet.getByRole("button", { name: "Pronto" }).click();
    await expect(sheet).toHaveCount(0);
  });

  await test.step("card de hoje, faixa da semana e exercícios", async () => {
    const strip = page.getByRole("list", { name: "Semana de treino" });
    await expect(strip.getByRole("listitem")).toHaveCount(7);
    const today = strip.locator('[aria-current="date"]');
    await expect(today).toContainText("Qui");
    await expect(today).toContainText("Perna");
    const card = page.getByRole("region", { name: "Perna · Treino A" });
    await expect(card).toContainText("Treino de hoje");
    await expect(card).toContainText("2 exercícios");
    await expect(card).toContainText("0/5");
    await expect(card.getByRole("button", { name: "Começar treino" })).toBeVisible();
    const items = page.getByRole("region", { name: "Exercícios" }).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Agachamento livre");
    await expect(items.nth(0)).toContainText("4 × 8 · 82,5 kg");
    await expect(items.nth(0)).toContainText("+20");
    await expect(page.getByLabel(/^Sequência: 0 semanas/)).toBeVisible();
    await page.screenshot({ path: "test-results/treino-semana.png", animations: "disabled", fullPage: true });
  });

  await test.step("Editar abre o editor do treino de hoje", async () => {
    await page.getByRole("region", { name: "Exercícios" }).getByRole("button", { name: "Editar" }).click();
    await expect(sheet.getByRole("heading", { name: "Editar Treino A" })).toBeVisible();
    await page.screenshot({ path: "test-results/treino-editor.png", animations: "disabled" });
    await sheet.getByRole("button", { name: "Voltar para a semana" }).click();
    await expect(sheet.getByRole("heading", { name: "Montar a semana" })).toBeVisible();
    await sheet.getByRole("button", { name: "Pronto" }).click();
  });
});

test("Treino: dia de folga oferece treinar mesmo assim", async ({ page, request }) => {
  const t = await (await request.post("/api/workout/templates", { data: { name: "Treino B", focus: "Costas" } })).json();
  const ex = await request.post(`/api/workout/templates/${t.template.id}/exercises`, {
    data: { name: "Remada curvada", sets: 3, reps: 10, weightG: 60000 },
  });
  expect(ex.status()).toBe(201);
  // Quinta continua folga (o plano só tem segunda).
  const plan = await request.put("/api/workout/plan", { data: { days: [{ weekday: 1, templateId: t.template.id }] } });
  expect(plan.ok()).toBe(true);

  await fakeServerToday(page, THURSDAY);
  await page.goto("/#treino");
  const card = page.getByRole("region", { name: "Hoje é folga" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("radio", { name: "Costas · Treino B" })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("button", { name: "Treinar mesmo assim" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Semana de treino" }).locator('[aria-current="date"]')).toContainText("Folga");
});
