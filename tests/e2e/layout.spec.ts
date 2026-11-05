import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { devices } from "@playwright/test";
import { todayISO } from "../../shared/dates";

// Projeto "desktop" (1440×900). Os blocos de celular trocam o viewport com test.use.
// Este arquivo apaga o que cria: os outros testes contam pastas e tarefas.

const FOLDER = "Layout · Vídeos";
const IDEA = "Revisão espaçada para estudar";

const created: { folders: string[]; tasks: string[] } = { folders: [], tasks: [] };

/** Algumas tarefas de hoje, para as capturas de tela mostrarem a coluna do dia de verdade. */
async function seedTasks(request: APIRequestContext) {
  if (created.tasks.length) return;
  const today = todayISO();
  const items = [
    { title: "Responder e-mail do fornecedor", date: today, area: "work", done: true },
    { title: "Estudar Cálculo, cap. 4", date: today, time: "23:58", area: "school" },
    { title: "Jantar com a namorada", date: today, time: "23:59", area: "personal" },
  ];
  for (const { done, ...data } of items) {
    const res = await request.post("/api/tasks", { data });
    expect(res.status()).toBe(201);
    const { task } = await res.json();
    created.tasks.push(task.id);
    if (done) await request.patch(`/api/tasks/${task.id}`, { data: { done: true } });
  }
}

/** Uma pasta com uma ideia; idempotente (vários testes chamam). */
async function seedIdea(request: APIRequestContext) {
  const { folders } = await (await request.get("/api/folders")).json();
  const existing = folders.find((x: { name: string }) => x.name === FOLDER);
  if (existing) return existing;
  const f = await request.post("/api/folders", { data: { name: FOLDER, emoji: "🎬" } });
  expect(f.status()).toBe(201);
  const { folder } = await f.json();
  created.folders.push(folder.id);
  const i = await request.post("/api/ideas", {
    data: { folderId: folder.id, title: IDEA, body: "Revisar no dia 1, 3, 7 e 14 depois da aula." },
  });
  expect(i.status()).toBe(201);
  return folder;
}

test.afterAll(async ({ request }) => {
  for (const id of created.folders) await request.delete(`/api/folders/${id}`);
  for (const id of created.tasks) await request.delete(`/api/tasks/${id}`);
  created.folders = [];
  created.tasks = [];
});

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  expect(b, "elemento sem caixa (invisível?)").not.toBeNull();
  return b!;
};

/** Cor CSS qualquer (rgb, oklab, color-mix…) → [r, g, b] sRGB, pelo canvas do próprio navegador. */
async function contrast(page: Page, fg: string, bg: string): Promise<number> {
  return page.evaluate(
    ([fg, bg]) => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const rgb = (c: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const a = lum(rgb(fg));
      const b = lum(rgb(bg));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    },
    [fg, bg],
  );
}

const style = (l: Locator, prop: string) => l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** Pares de cor que precisam ser legíveis (texto normal, ≥ 4,5:1). */
async function expectReadable(page: Page) {
  const body = page.locator("body");
  const bg = await style(body, "background-color");
  const ink = await style(body, "color");
  expect(await contrast(page, ink, bg), "texto × fundo").toBeGreaterThanOrEqual(4.5);

  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return { bg: v("--bg"), surface: v("--surface"), ink: v("--ink"), muted: v("--muted"), accent: v("--accent"), fill: v("--accent-fill"), onFill: v("--on-accent"), danger: v("--danger-ink") };
  });
  expect(await contrast(page, tokens.ink, tokens.surface), "texto × cartão").toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page, tokens.muted, tokens.bg), "secundário × fundo").toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page, tokens.muted, tokens.surface), "secundário × cartão").toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page, tokens.accent, tokens.surface), "destaque × cartão").toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page, tokens.danger, tokens.surface), "erro × cartão").toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page, tokens.onFill, tokens.fill), "texto em botão roxo").toBeGreaterThanOrEqual(4.5);

  // O dia escolhido na faixa da semana é um botão roxo cheio, com o número em branco.
  const day = page.getByRole("navigation", { name: "Dias da semana" }).locator('[aria-pressed="true"]');
  const dayBg = await style(day, "background-color");
  const dayInk = await style(day.locator("span").nth(1), "color");
  expect(await contrast(page, dayInk, dayBg), "dia escolhido").toBeGreaterThanOrEqual(4.5);
}

async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, "rolagem horizontal").toBeLessThanOrEqual(client);
}

test.describe("computador (1440×900)", () => {
  test("Hoje fixo à esquerda e Ideias em três colunas, sem barra de abas", async ({ page, request }) => {
    await seedIdea(request);
    await seedTasks(request);
    await page.goto("/");

    const today = page.getByTestId("today-pane");
    const folders = page.getByTestId("folders-pane");
    const list = page.getByTestId("list-pane");
    const editor = page.getByTestId("editor-pane");

    await test.step("sem abas; Hoje, pastas e Recentes lado a lado (sem painel de editor vazio)", async () => {
      await expect(page.getByRole("navigation", { name: "Seções" })).toHaveCount(0);
      for (const pane of [today, folders, list]) await expect(pane).toBeVisible();
      await expect(editor).toHaveCount(0);
      await expect(list.getByRole("heading", { name: "Recentes" })).toBeVisible();
      await expect(list.getByRole("button", { name: new RegExp(IDEA) }).first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(2); // Hoje e Ideias
      await expect(today.getByRole("heading", { level: 1 })).toHaveText("Hoje");
      await expect(today.getByRole("navigation", { name: "Dias da semana" })).toBeVisible();

      const t = await box(today);
      const f = await box(folders);
      const l = await box(list);
      expect(t.x).toBeLessThanOrEqual(1);
      expect(t.width).toBeGreaterThanOrEqual(375);
      expect(t.width).toBeLessThanOrEqual(385);
      expect(t.height).toBeGreaterThanOrEqual(840); // 900 menos a barra de 52 px
      expect(f.x).toBeGreaterThanOrEqual(t.x + t.width - 1);
      expect(l.x).toBeGreaterThanOrEqual(f.x + f.width - 1);
      expect(l.x + l.width).toBeGreaterThan(1430);
      expect(l.width).toBeGreaterThan(f.width);
    });

    await test.step("a janela não rola; cada coluna rola sozinha", async () => {
      const doc = await page.evaluate(() => ({
        h: document.documentElement.scrollHeight,
        vh: window.innerHeight,
      }));
      expect(doc.h).toBeLessThanOrEqual(doc.vh);
      expect(await style(today, "overflow-y")).toMatch(/auto|scroll/);
      await expectNoHorizontalScroll(page);
    });

    await test.step("captura dentro da coluna do Hoje, com a dica Ctrl K", async () => {
      const field = today.getByRole("textbox", { name: "Captura rápida" });
      await expect(field).toBeVisible();
      await expect(page.getByRole("banner").getByText("Ctrl K")).toBeVisible();
      await expect(page.getByRole("banner").getByRole("button", { name: "Resumo da semana" })).toBeVisible();
      const c = await box(field);
      const t = await box(today);
      expect(c.x + c.width).toBeLessThanOrEqual(t.x + t.width);
      await page.keyboard.press("Control+k");
      await expect(field).toBeFocused();
    });

    await test.step("pasta → lista → editor, com o Hoje sempre à vista", async () => {
      await folders.getByRole("button", { name: new RegExp(`Abrir pasta ${FOLDER}`) }).click();
      await expect(editor).toContainText("Escolha uma ideia");
      const [fb, lb, eb] = [await box(folders), await box(list), await box(editor)];
      expect(lb.x).toBeGreaterThanOrEqual(fb.x + fb.width - 1);
      expect(eb.x).toBeGreaterThanOrEqual(lb.x + lb.width - 1);
      expect(eb.x + eb.width).toBeGreaterThan(1430);
      expect(eb.width).toBeGreaterThan(lb.width);
      await expect(list.getByRole("heading", { name: new RegExp(FOLDER) })).toBeVisible();
      // Botão de nova ideia mora na coluna da lista, não no canto da janela.
      const plus = list.getByRole("button", { name: "Nova ideia" });
      await expect(plus).toBeVisible();
      const p = await box(plus);
      const l = await box(list);
      expect(p.x).toBeGreaterThanOrEqual(l.x);
      expect(p.x + p.width).toBeLessThanOrEqual(l.x + l.width);

      await list.getByRole("button", { name: new RegExp(IDEA) }).click();
      await expect(editor.getByLabel("Título")).toHaveValue(IDEA);
      await expect(list.getByRole("button", { name: new RegExp(IDEA) })).toHaveAttribute("aria-current", "true");
      await expect(today).toBeVisible();
      // Sem "voltar" no computador: as colunas já mostram onde se está.
      await expect(page.getByRole("button", { name: /^Voltar para/ })).toHaveCount(0);
    });

    await page.screenshot({ path: "test-results/layout-desktop-light.png", animations: "disabled" });
  });

  test.describe("escuro", () => {
    test.use({ colorScheme: "dark" });

    test("tema escuro legível", async ({ page, request }) => {
      await seedIdea(request);
      await seedTasks(request);
      await page.goto("/");
      await page.getByTestId("folders-pane").getByRole("button", { name: new RegExp(`Abrir pasta ${FOLDER}`) }).first().click();
      await page.getByTestId("list-pane").getByRole("button", { name: new RegExp(IDEA) }).first().click();
      await expect(page.getByTestId("editor-pane").getByLabel("Título")).toHaveValue(IDEA);
      await expectReadable(page);
      await page.screenshot({ path: "test-results/layout-desktop-dark.png", animations: "disabled" });
    });
  });
});

test.describe("celular", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 13"].userAgent,
  });

  test("barra de abas e uma tela por vez", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("navigation", { name: "Seções" });
    await expect(tabs).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
    await expect(page.getByTestId("folders-pane")).toHaveCount(0);
    await expect(page.getByTestId("list-pane")).toHaveCount(0);

    await tabs.getByRole("button", { name: "Ideias" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ideias");
    await expect(page.getByRole("navigation", { name: "Dias da semana" })).toHaveCount(0);
  });

  test("campos com fonte de 16 px ou mais (iOS não dá zoom)", async ({ page, request }) => {
    await seedIdea(request);
    const check = async () => {
      const sizes = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"))
          .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0)
          .map((el) => ({ id: el.id || el.tagName, size: parseFloat(getComputedStyle(el).fontSize) })),
      );
      expect(sizes.length).toBeGreaterThan(0);
      for (const s of sizes) expect(s.size, `fonte de ${s.id}`).toBeGreaterThanOrEqual(16);
    };
    await page.goto("/");
    await page.getByRole("button", { name: "Fixar uma anotação" }).click();
    await check();
    const tabs = page.getByRole("navigation", { name: "Seções" });
    await tabs.getByRole("button", { name: "Ideias" }).click();
    await check();
    await page.getByRole("button", { name: new RegExp(`Abrir pasta ${FOLDER}`) }).click();
    await page.getByRole("button", { name: new RegExp(IDEA) }).click();
    await check();
  });

  test.describe("375 px", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("sem rolagem horizontal em nenhuma tela", async ({ page, request }) => {
      await seedIdea(request);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
      await expectNoHorizontalScroll(page);
      await page.getByRole("navigation", { name: "Seções" }).getByRole("button", { name: "Ideias" }).click();
      await expectNoHorizontalScroll(page);
      await page.getByRole("button", { name: new RegExp(`Abrir pasta ${FOLDER}`) }).click();
      await expect(page.getByRole("button", { name: new RegExp(IDEA) })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.getByRole("button", { name: new RegExp(IDEA) }).click();
      await expect(page.getByLabel("Título")).toHaveValue(IDEA);
      await expectNoHorizontalScroll(page);
    });
  });

  test.describe("escuro", () => {
    test.use({ colorScheme: "dark" });

    test("tema escuro legível no celular", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoje");
      await expectReadable(page);
      const theme = await page.evaluate(() =>
        Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => m.getAttribute("media")),
      );
      expect(theme).toEqual(expect.arrayContaining(["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"]));
      await page.screenshot({ path: "test-results/layout-mobile-dark.png", animations: "disabled" });
    });
  });
});
