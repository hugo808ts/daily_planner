import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays, todayISO, weekStart } from "../../shared/dates";
import { isoWeekday } from "../../shared/workout";

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

/** Treino A (Supino reto 3 × 8 · 60 kg) na quinta e uma sessão concluída na quinta passada (60 kg × 8 nas 3 séries). */
async function seedSupino(request: APIRequestContext, today = THURSDAY) {
  const t = (await (await request.post("/api/workout/templates", { data: { name: "Treino A", focus: "Peito" } })).json()).template;
  const ex = (
    await (
      await request.post(`/api/workout/templates/${t.id}/exercises`, {
        data: { name: "Supino reto", sets: 3, reps: 8, weightG: 60000, restS: 90 },
      })
    ).json()
  ).exercise;
  expect((await request.put("/api/workout/plan", { data: { days: [{ weekday: isoWeekday(today), templateId: t.id }] } })).ok()).toBe(true);
  const lastWeek = { "x-test-today": addDays(today, -7) };
  const s = (await (await request.post("/api/workout/sessions", { data: { templateId: t.id }, headers: lastWeek })).json()).session;
  for (const setIndex of [1, 2, 3]) {
    const r = await request.post(`/api/workout/sessions/${s.id}/sets`, {
      data: { exerciseId: ex.id, setIndex, weightG: 60000, reps: 8 },
      headers: lastWeek,
    });
    expect(r.status()).toBe(201);
  }
  expect((await request.post(`/api/workout/sessions/${s.id}/finish`, { headers: lastWeek })).ok()).toBe(true);
  return { template: t, exercise: ex };
}

test("Treino ao vivo: séries, descanso, recorde e resumo", async ({ page, request }) => {
  await seedSupino(request);
  await page.clock.install();
  await fakeServerToday(page, THURSDAY);
  await page.goto("/#treino");

  const live = page.getByRole("region", { name: "Treino ao vivo" });
  await test.step("começar: tela cheia com a última vez e a meta de hoje", async () => {
    await page.getByRole("button", { name: "Começar treino" }).click();
    await expect(live).toBeVisible();
    await expect(live.getByRole("heading", { name: "Supino reto" })).toBeVisible();
    await expect(live).toContainText("Última vez: 60 kg × 8");
    await expect(live.getByLabel("Peso", { exact: true })).toHaveText(/^60\s*kg$/);
    await live.getByRole("button", { name: /Meta hoje: subir para 62,5 kg/ }).click();
    await expect(live.getByLabel("Peso", { exact: true })).toHaveText(/^62,5\s*kg$/);
    await page.screenshot({ path: "test-results/treino-ao-vivo.png", animations: "disabled" });
  });

  await test.step("S1 salva na hora e abre o descanso; Já estou pronto fecha", async () => {
    await live.getByRole("button", { name: "Concluir série 1 · descanso 1:30" }).click();
    await expect(live.getByRole("timer")).toBeVisible();
    await expect(live.getByRole("timer")).toContainText("1:30");
    await live.getByRole("button", { name: "Mais 15 segundos" }).click();
    await expect(live.getByRole("timer")).toContainText("de 1:45");
    await expect(live).toContainText("Supino reto · S2");
    await page.screenshot({ path: "test-results/treino-descanso.png", animations: "disabled" });
    await live.getByRole("button", { name: "Já estou pronto" }).click();
    await expect(live.getByRole("timer")).toHaveCount(0);
    const rows = live.getByRole("list", { name: "Séries de Supino reto" }).getByRole("listitem");
    await expect(rows.nth(0)).toContainText("62,5 × 8");
    await expect(rows.nth(0)).toContainText("RECORDE");
    await expect(live).toContainText("+35 XP");
  });

  await test.step("reabrir o app volta para a série certa", async () => {
    await page.reload();
    await expect(live).toBeVisible();
    await expect(live.getByRole("list", { name: "Séries de Supino reto" }).locator('[aria-current="step"]')).toContainText("S2");
  });

  await test.step("S2: o descanso termina sozinho pelo relógio", async () => {
    await live.getByRole("button", { name: /^Concluir série 2/ }).click();
    await expect(live.getByRole("timer")).toBeVisible();
    await page.clock.fastForward("01:31");
    await expect(live.getByRole("timer")).toHaveCount(0);
    await expect(live.getByRole("list", { name: "Séries de Supino reto" }).locator('[aria-current="step"]')).toContainText("S3");
  });

  await test.step("última série, finalizar e resumo com ↑", async () => {
    await live.getByRole("button", { name: "Concluir série 3" }).click();
    await page.getByRole("button", { name: "Finalizar treino" }).click();
    await expect(live.getByText("Treino concluído")).toBeVisible();
    const row = live.getByRole("list", { name: "Exercícios do treino" }).getByRole("listitem").first();
    await expect(row).toContainText("Supino reto");
    await expect(row.getByLabel("subiu")).toHaveText("↑ 2,5 kg");
    await page.screenshot({ path: "test-results/treino-resumo.png", animations: "disabled" });
    await live.getByRole("button", { name: "Salvar e fechar" }).click();
    await expect(live).toHaveCount(0);
    await expect(page.getByText("Feito hoje. Bom trabalho!")).toBeVisible();
  });
});

test("Treino ao vivo: sair e descartar", async ({ page, request }) => {
  // Sexta: a quinta já tem treino concluído do teste anterior (o D1 do e2e não apaga sessões).
  const friday = addDays(THURSDAY, 1);
  await seedSupino(request, friday);
  await fakeServerToday(page, friday);
  await page.goto("/#treino");
  await page.getByRole("button", { name: "Começar treino" }).click();
  const live = page.getByRole("region", { name: "Treino ao vivo" });
  await live.getByRole("button", { name: "Sair do treino" }).click();
  await page.getByRole("button", { name: "Continuar depois" }).click();
  await expect(live).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar treino" }).click();
  await expect(live).toBeVisible();
  await live.getByRole("button", { name: "Sair do treino" }).click();
  await page.getByRole("button", { name: "Descartar treino" }).click();
  await expect(live).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Começar treino" })).toBeVisible();
});

test("Progresso: brasão, conquistas e relatório semana × semana", async ({ page, request }) => {
  const t = (await (await request.post("/api/workout/templates", { data: { name: "Treino C", focus: "Costas" } })).json()).template;
  const ex = (
    await (
      await request.post(`/api/workout/templates/${t.id}/exercises`, {
        data: { name: "Remada curvada", sets: 2, reps: 10, weightG: 65000 },
      })
    ).json()
  ).exercise;
  // Quarta passada 65 kg, quarta desta semana 70 kg.
  const wednesday = addDays(THURSDAY, -1);
  for (const [day, weightG] of [
    [addDays(wednesday, -7), 65000],
    [wednesday, 70000],
  ] as const) {
    const headers = { "x-test-today": day };
    const s = (await (await request.post("/api/workout/sessions", { data: { templateId: t.id }, headers })).json()).session;
    for (const setIndex of [1, 2]) {
      const r = await request.post(`/api/workout/sessions/${s.id}/sets`, {
        data: { exerciseId: ex.id, setIndex, weightG, reps: 10 },
        headers,
      });
      expect(r.status()).toBe(201);
    }
    expect((await request.post(`/api/workout/sessions/${s.id}/finish`, { headers })).ok()).toBe(true);
  }

  await fakeServerToday(page, THURSDAY);
  await page.goto("/#treino");

  const progress = page.getByRole("region", { name: "Progresso" });
  await expect(progress).toContainText("Brasão da semana");
  await expect(progress.getByRole("list", { name: "Conquistas" }).getByRole("listitem")).toHaveCount(6);
  await expect(progress.getByLabel(/^Recordista: .*Conquistada$/)).toBeVisible();
  await expect(progress.getByLabel(/^Inquebrável: .*Bloqueada$/)).toBeVisible();

  const report = page.getByRole("region", { name: "Relatório de treino" });
  await expect(report.getByRole("radio")).toHaveCount(4);
  await expect(report.getByRole("radio").last()).toHaveAttribute("aria-checked", "true");
  await expect(report).toContainText("subiram");
  const row = report.getByRole("list", { name: "Carga por exercício" }).getByRole("listitem").filter({ hasText: "Remada curvada" });
  await expect(row).toContainText("70 kg");
  await expect(row.getByLabel("subiu 5 kg")).toHaveText("↑ 5 kg");

  await progress.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/treino-progresso.png", animations: "disabled" });

  // Semana anterior: a remada aparece como novidade (sem semana antes dela).
  await report.getByRole("radio").nth(2).click();
  await expect(report.getByRole("radio").nth(2)).toHaveAttribute("aria-checked", "true");
  const before = report.getByRole("list", { name: "Carga por exercício" }).getByRole("listitem").filter({ hasText: "Remada curvada" });
  await expect(before).toContainText("65 kg");
  await expect(before.getByLabel("sem semana anterior")).toHaveText("novo");
});
