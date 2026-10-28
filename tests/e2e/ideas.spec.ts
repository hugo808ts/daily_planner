import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays, todayISO, weekDays, weekStart } from "../../shared/dates";
import { shortDay } from "../../src/lib/format";

// Servidor com DEV=true e D1 local isolado. Os outros arquivos E2E também criam pastas,
// então este começa apagando todas para ver a tela de primeira visita.
const TODAY = todayISO();
const TOMORROW = addDays(TODAY, 1);
const OTHER = weekDays(weekStart(TODAY)).find((d) => d > TOMORROW) ?? addDays(TODAY, 2);

const TIKTOK = "https://www.tiktok.com/@estudacomigo/video/7312345678901234567";

test.describe.configure({ mode: "serial" });

async function clearFolders(request: APIRequestContext) {
  const { folders } = await (await request.get("/api/folders")).json();
  for (const f of folders) expect((await request.delete(`/api/folders/${f.id}`)).ok()).toBe(true);
}

const openIdeas = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Ideias" }).click();
};
const cards = (page: Page) => page.getByRole("list", { name: "Ideias da pasta" }).getByRole("listitem");
const card = (page: Page, title: string) => cards(page).filter({ hasText: title });
const saveState = (page: Page) => page.getByTestId("save-state");

test.beforeAll(async ({ request }) => {
  await clearFolders(request);
});

test("pastas: primeira visita, criar com emoji e renomear", async ({ page }) => {
  await openIdeas(page);

  await test.step("primeira visita pede a primeira pasta", async () => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ideias");
    await expect(page.getByText("Crie sua primeira pasta")).toBeVisible();
  });

  await test.step("criar pasta com emoji", async () => {
    await page.getByRole("button", { name: "Nova pasta" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Nova pasta" });
    await sheet.getByLabel("Emoji (opcional)").fill("🎬");
    await sheet.getByLabel("Nome da pasta").fill("Vídeos");
    await sheet.getByRole("button", { name: "Criar pasta" }).click();
    await expect(sheet).toBeHidden();
    const tile = page.getByRole("listitem").filter({ hasText: "Vídeos" });
    await expect(tile).toContainText("🎬");
    await expect(tile).toContainText("0 ideias");
    await expect(page.getByText("Crie sua primeira pasta")).toHaveCount(0);
  });

  await test.step("renomear a pasta", async () => {
    await page.getByRole("button", { name: "Editar pasta Vídeos" }).click();
    const sheet = page.getByRole("dialog", { name: "Editar pasta" });
    await sheet.getByLabel("Nome da pasta").fill("Vídeos TikTok");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir pasta Vídeos TikTok" })).toBeVisible();
  });

  await page.screenshot({ path: "test-results/ideas-folders-390x844.png" });
});

test("ideias: link, fixar, autosalvar, resolver e desfazer", async ({ page, request }) => {
  await openIdeas(page);
  await page.getByRole("button", { name: "Abrir pasta Vídeos TikTok" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vídeos TikTok");

  await test.step("nova ideia com link: o cartão mostra o site", async () => {
    await page.getByRole("button", { name: "Nova ideia" }).click();
    await page.getByLabel("Título").fill("Revisão espaçada para estudar");
    await page.getByLabel("Link").fill(TIKTOK);
    await page.getByLabel("Texto").fill("Revisar no dia 1, 3, 7 e 14 depois da aula.");
    await expect(saveState(page)).toHaveText("Salvo", { timeout: 10_000 });
    await page.getByRole("button", { name: "Voltar para Vídeos TikTok" }).click();
    await expect(card(page, "Revisão espaçada para estudar")).toContainText("tiktok.com");
  });

  await test.step("fixar leva a ideia para o topo", async () => {
    await page.getByRole("button", { name: "Nova ideia" }).click();
    await page.getByLabel("Título").fill("Receita de marmita da semana");
    await expect(saveState(page)).toHaveText("Salvo");
    await page.getByRole("button", { name: "Voltar para Vídeos TikTok" }).click();
    await expect(cards(page).first()).toContainText("Receita de marmita da semana");

    await card(page, "Revisão espaçada para estudar").getByRole("button", { name: "Fixar no topo" }).click();
    await expect(cards(page).first()).toContainText("Revisão espaçada para estudar");
    await expect(cards(page).first()).toContainText("fixada");
    await expect(cards(page).nth(1)).toContainText("Receita de marmita da semana");
  });

  await page.screenshot({ path: "test-results/ideas-list-390x844.png" });

  await test.step("o editor salva sozinho 800 ms depois de parar de digitar", async () => {
    await card(page, "Receita de marmita da semana").getByRole("button", { name: /Receita de marmita/ }).click();
    await page.getByLabel("Texto").fill("Frango, arroz integral e legumes. Fazer no domingo.");
    await expect(saveState(page)).toHaveText("Salvando…");
    await expect(saveState(page)).toHaveText("Salvo");
    await page.reload();
    await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Ideias" }).click();
    await page.getByRole("button", { name: "Abrir pasta Vídeos TikTok" }).click();
    await card(page, "Receita de marmita da semana").getByRole("button", { name: /Receita de marmita/ }).click();
    await expect(page.getByLabel("Texto")).toHaveValue("Frango, arroz integral e legumes. Fazer no domingo.");
  });

  await page.screenshot({ path: "test-results/ideas-editor-390x844.png" });

  await test.step("Resolvida pede confirmação, apaga e oferece Desfazer", async () => {
    await page.getByRole("button", { name: "✓ Resolvida" }).click();
    const ask = page.getByRole("alertdialog", { name: "Concluir e apagar esta ideia?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Apagar" }).click();
    await expect(ask).toBeHidden();
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, "Receita de marmita da semana")).toHaveCount(0);
    const toast = page.getByRole("status");
    await expect(toast).toContainText("Ideia apagada");
    await expect(toast.getByRole("button", { name: "Desfazer" })).toBeVisible();
  });

  await test.step("Desfazer devolve a ideia no mesmo lugar", async () => {
    await page.getByRole("status").getByRole("button", { name: "Desfazer" }).click();
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).nth(1)).toContainText("Receita de marmita da semana");
    const { folders } = await (await request.get("/api/folders")).json();
    const { ideas } = await (await request.get(`/api/folders/${folders[0].id}/ideas`)).json();
    expect(ideas.map((i: { title: string }) => i.title)).toEqual([
      "Revisão espaçada para estudar",
      "Receita de marmita da semana",
    ]);
    expect(ideas[1].body).toBe("Frango, arroz integral e legumes. Fazer no domingo.");
  });
});

test("busca acha ideia de outra pasta e abre", async ({ page, request }) => {
  const { folder } = await (await request.post("/api/folders", { data: { name: "Estudos", emoji: "📚" } })).json();
  const res = await request.post("/api/ideas", {
    data: { folderId: folder.id, title: "Fórmula de Bhaskara", body: "Revisar antes da prova de cálculo." },
  });
  expect(res.status()).toBe(201);

  await openIdeas(page);
  await page.getByRole("searchbox", { name: "Buscar em todas as ideias" }).fill("bhaskara");
  const result = page.getByRole("list", { name: "Resultados da busca" }).getByRole("listitem");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("Estudos");
  await result.getByRole("button", { name: /Fórmula de Bhaskara/ }).click();

  await expect(page.getByLabel("Título")).toHaveValue("Fórmula de Bhaskara");
  await page.getByRole("button", { name: "Voltar para Estudos" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Estudos");
  await expect(card(page, "Fórmula de Bhaskara")).toBeVisible();
});

test("Virar tarefa abre a confirmação, salva no dia escolhido e mantém a ideia", async ({ page, request }) => {
  await openIdeas(page);
  await page.getByRole("button", { name: "Abrir pasta Estudos" }).click();
  await card(page, "Fórmula de Bhaskara").getByRole("button", { name: /Fórmula de Bhaskara/ }).click();

  await page.getByRole("button", { name: "📅 Virar tarefa" }).click();
  const sheet = page.getByRole("dialog", { name: "Confirmar captura" });
  await expect(sheet).toContainText("✓ Tarefa");
  await expect(sheet).toContainText("Fórmula de Bhaskara");
  await expect(sheet.getByRole("button", { name: /^Dia:/ })).toContainText("Hoje");
  await sheet.getByRole("button", { name: /^Dia:/ }).click();
  await sheet.getByLabel("Dia", { exact: true }).fill(OTHER);
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Tarefa salva");
  await expect(page.getByLabel("Título")).toHaveValue("Fórmula de Bhaskara");

  const week = await (await request.get(`/api/week?start=${weekStart(OTHER)}`)).json();
  const task = week.tasks.find((t: { title: string }) => t.title === "Fórmula de Bhaskara");
  expect(task).toMatchObject({ date: OTHER });

  await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Hoje" }).click();
  await page
    .getByRole("navigation", { name: "Dias da semana" })
    .getByRole("button", { name: new RegExp(shortDay(OTHER).replace(" ", ".*")) })
    .click();
  await expect(page.getByRole("listitem").filter({ hasText: "Fórmula de Bhaskara" })).toBeVisible();

  const { folders } = await (await request.get("/api/folders")).json();
  const estudos = folders.find((f: { name: string }) => f.name === "Estudos");
  const { ideas } = await (await request.get(`/api/folders/${estudos.id}/ideas`)).json();
  expect(ideas.map((i: { title: string }) => i.title)).toContain("Fórmula de Bhaskara");

  // Não deixa a tarefa para o teste da tela Hoje.
  expect((await request.delete(`/api/tasks/${task.id}`)).ok()).toBe(true);
});

test("apagar pasta pergunta quantas ideias vão junto", async ({ page, request }) => {
  await openIdeas(page);
  await page.getByRole("button", { name: "Editar pasta Estudos" }).click();
  await page.getByRole("dialog", { name: "Editar pasta" }).getByRole("button", { name: "Apagar pasta" }).click();
  const ask = page.getByRole("alertdialog", { name: "Apagar a pasta e a 1 ideia dentro?" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByRole("dialog", { name: "Editar pasta" })).toBeHidden();
  await expect(page.getByRole("button", { name: /Abrir pasta Estudos/ })).toHaveCount(0);
  const { folders } = await (await request.get("/api/folders")).json();
  expect(folders.map((f: { name: string }) => f.name)).toEqual(["Vídeos TikTok"]);
});
