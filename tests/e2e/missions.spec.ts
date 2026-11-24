import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays } from "../../shared/dates";
import { isoWeekday } from "../../shared/workout";

// Semana própria e antiga (junho de 2020), longe das datas dos outros specs.
// As sementes da migração começam no dia em que o banco foi criado, então não valem em 2020:
// este arquivo cria as próprias missões com X-Test-Today e as arquiva no fim (somem dos outros dias).
const TODAY = "2020-06-03"; // quarta
const H = { "x-test-today": TODAY };
const SHOTS = process.env.SHOTS_DIR ?? "test-results";

const created: string[] = [];

async function createMission(request: APIRequestContext, title: string, attribute: string, xp: number) {
  const res = await request.post("/api/missions", { data: { title, attribute, xp }, headers: H });
  expect(res.status()).toBe(201);
  const { mission } = await res.json();
  created.push(mission.id);
  return mission;
}

/** O D1 do e2e é um só por execução: sai sem treinos nem sessão aberta (o layout espera "Monte sua semana"). */
async function resetWorkout(request: APIRequestContext) {
  const view = await (await request.get("/api/workout", { headers: H })).json();
  if (view.openSession) await request.delete(`/api/workout/sessions/${view.openSession.id}`, { headers: H });
  for (const t of view.templates) await request.delete(`/api/workout/templates/${t.id}`, { headers: H });
}

async function openToday(page: Page) {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00-03:00`) });
  await page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), ...H } }));
  await page.goto("/#hoje");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await createMission(request, "Alongar 5 min", "fisica", 10);
  await createMission(request, "Orar 5 min", "espiritual", 5);
});

test.afterAll(async ({ request }) => {
  // Arquiva no dia seguinte: valem só em TODAY (sem marcação, apaga).
  const next = { "x-test-today": addDays(TODAY, 1) };
  for (const id of created) await request.delete(`/api/missions/${id}`, { headers: next });
  await resetWorkout(request);
});

test("as 2 missões da migração aparecem no Hoje de verdade", async ({ page }) => {
  await page.goto("/#hoje");
  const card = page.getByRole("region", { name: /Rotina do dia/ });
  await expect(card.getByRole("checkbox", { name: /^Ler 10 páginas: \+20 XP, Mental/ })).toBeVisible();
  await expect(card.getByRole("checkbox", { name: /^Meditar 10 min: \+10 XP, Espiritual/ })).toBeVisible();
});

test("marcar as 2 acende a janela de hoje e o XP sobe; desmarcar volta", async ({ page }) => {
  await openToday(page);
  const card = page.getByRole("region", { name: /Rotina do dia/ });
  const a = card.getByRole("checkbox", { name: /^Alongar 5 min/ });
  const b = card.getByRole("checkbox", { name: /^Orar 5 min/ });
  await expect(card.getByRole("heading")).toHaveText("Rotina do dia · 0/2");

  await a.click();
  await expect(a).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("heading")).toHaveText("Rotina do dia · 1/2");
  await expect(page.getByText("+10 XP hoje")).toBeVisible();
  await expect(card).not.toContainText("Rotina completa");

  await b.click();
  await expect(b).toHaveAttribute("aria-checked", "true");
  await expect(card).toContainText("Rotina completa");
  await expect(page.getByText("+15 XP hoje")).toBeVisible();
  await expect(card.getByRole("img", { name: /quarta cumprido/ })).toBeVisible();
  await page.waitForTimeout(1000); // XpPop some
  await page.screenshot({ path: `${SHOTS}/missoes-hoje-390x844.png` });

  // Recarregar mantém (veio do servidor).
  await page.reload();
  await expect(card.getByRole("checkbox", { name: /^Orar 5 min/ })).toHaveAttribute("aria-checked", "true");
  await expect(card).toContainText("Rotina completa");

  await card.getByRole("checkbox", { name: /^Orar 5 min/ }).click();
  await expect(card.getByRole("checkbox", { name: /^Orar 5 min/ })).toHaveAttribute("aria-checked", "false");
  await expect(card).toContainText("Faça as 2 para completar a rotina.");
  await expect(page.getByText("+10 XP hoje")).toBeVisible();
  await card.getByRole("checkbox", { name: /^Alongar 5 min/ }).click();
  await expect(card.getByRole("checkbox", { name: /^Alongar 5 min/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText(/XP hoje/)).toHaveCount(0);
});

test("criar uma missão de +35 Física, ver o XP travado e arquivar", async ({ page }) => {
  await openToday(page);
  const card = page.getByRole("region", { name: /Rotina do dia/ });
  await card.getByRole("button", { name: "Editar rotina" }).click();
  // O nome da folha muda com a etapa (Missões diárias → Nova missão).
  const sheet = page.getByRole("dialog");
  await expect(page.getByRole("dialog", { name: "Rotina do dia" })).toBeVisible();
  await sheet.getByRole("button", { name: "Novo hábito" }).click();
  await expect(sheet.getByRole("heading", { name: "Novo hábito" })).toBeVisible();
  await sheet.getByLabel("Título").fill("Correr 2 km");
  await sheet.getByRole("radio", { name: "Física" }).click();
  await sheet.getByRole("radio", { name: "+35 XP" }).click();
  await sheet.getByRole("button", { name: "Criar hábito" }).click();
  await expect(sheet.getByRole("list", { name: "Hábitos da rotina" }).getByText("Correr 2 km")).toBeVisible();
  await sheet.getByRole("button", { name: "Pronto" }).click();
  await expect(sheet).toHaveCount(0);

  const run = card.getByRole("checkbox", { name: /^Correr 2 km: \+35 XP, Física/ });
  await expect(run).toBeVisible();
  await expect(card.getByRole("heading")).toHaveText("Rotina do dia · 0/3");

  // Marcada uma vez, XP e atributo travam.
  await run.click();
  await expect(run).toHaveAttribute("aria-checked", "true");
  await card.getByRole("button", { name: "Editar rotina" }).click();
  await sheet.getByRole("button", { name: /^Correr 2 km/ }).click();
  await expect(page.getByRole("dialog", { name: "Editar hábito" }).getByText("Arquive e crie outra para mudar o XP.")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("radio", { name: "+35 XP" })).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Voltar para a rotina" }).click();

  await page.getByRole("dialog").getByRole("button", { name: "Arquivar Correr 2 km" }).click();
  await expect(page.getByText('Hábito "Correr 2 km" arquivado')).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Pronto" }).click();
  await expect(card.getByRole("checkbox", { name: /^Correr 2 km/ })).toHaveCount(0);
  await expect(card.getByRole("heading")).toHaveText("Rotina do dia · 0/2");
});

test("INICIAR no treino do dia abre o Treino com a sessão aberta", async ({ page, request }) => {
  await resetWorkout(request);
  const t = (await (await request.post("/api/workout/templates", { data: { name: "Treino C", focus: "Perna" }, headers: H })).json()).template;
  for (const name of ["Agachamento", "Leg press"]) {
    const ex = await request.post(`/api/workout/templates/${t.id}/exercises`, {
      data: { name, sets: 3, reps: 10, weightG: 60000 },
      headers: H,
    });
    expect(ex.status()).toBe(201);
  }
  expect((await request.put("/api/workout/plan", { data: { days: [{ weekday: isoWeekday(TODAY), templateId: t.id }] }, headers: H })).ok()).toBe(true);

  await openToday(page);
  const start = page.getByRole("button", { name: "Iniciar treino: Treino C · Perna" });
  await expect(start).toBeVisible();
  await expect(page.getByText("2 exercícios · Física")).toBeVisible();
  await start.click();
  await expect(page).toHaveURL(/#treino$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Treino");
  const view = await (await request.get("/api/workout", { headers: H })).json();
  expect(view.openSession).toMatchObject({ templateId: t.id, date: TODAY });

  // De volta ao Hoje: o compromisso vira CONTINUAR.
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Hoje" }).click();
  await expect(page.getByRole("button", { name: "Continuar treino: Treino C" })).toBeVisible();
});
