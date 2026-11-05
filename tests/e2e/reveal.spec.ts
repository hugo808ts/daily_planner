import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addDays } from "../../shared/dates";

// Semanas antigas e fixas (março de 2020), antes de qualquer data usada pelos outros specs:
// o nível "até esta semana" depende só do que este arquivo semeia.
const WARMUP = "2020-02-24"; // 4 médias = 100 XP
const GOLD = "2020-03-02"; // 9 altas = 450 XP -> Ouro; total 550 -> nível 2 (250/360)
const SUPREME = "2020-03-09"; // 16 altas = 800 XP -> Supremo; total 1350 -> nível 4 (258/518)
const EMPTY = "2020-03-16"; // nada feito -> sem medalha

/** Capturas para revisão (fora do repositório quando SHOTS_DIR estiver definido). */
const SHOTS = process.env.SHOTS_DIR ?? "test-results";

type Difficulty = "low" | "medium" | "high";

async function seed(request: APIRequestContext, date: string, difficulty: Difficulty, n: number, done = true) {
  for (let i = 0; i < n; i++) {
    const res = await request.post("/api/tasks", {
      data: { title: `${difficulty} ${date} ${i + 1}`, date, difficulty },
    });
    expect(res.status()).toBe(201);
    const { task } = await res.json();
    if (done) expect((await request.patch(`/api/tasks/${task.id}`, { data: { done: true } })).ok()).toBe(true);
  }
}

/** Abre o app no domingo que fecha a semana `start`. */
async function openSunday(page: Page, start: string) {
  const sunday = addDays(start, 6);
  await page.clock.install({ time: new Date(`${sunday}T10:00:00-03:00`) });
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-test-today": sunday },
    }),
  );
  await page.goto("/");
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await seed(request, WARMUP, "medium", 4);
  await seed(request, GOLD, "high", 9);
  await seed(request, GOLD, "low", 2, false); // não feitas: não somam nem tiram
  await seed(request, SUPREME, "high", 16);
});

test("Domingo: cartão com a medalha abre a revelação Ouro; detalhes levam ao resumo", async ({ page }) => {
  await openSunday(page, GOLD);

  const card = page.getByRole("button", { name: /Sua semana fechou/ });
  await expect(card).toContainText("Semana Ouro · 450 XP");
  // A medalha do cartão é decorativa (o nome do botão já diz a semana).
  await expect(card.locator('svg[aria-label="Medalha Ouro"]')).toBeVisible();
  await card.click();

  const reveal = page.getByRole("dialog", { name: "Medalha da semana" });
  await expect(reveal).toBeVisible();
  await expect(reveal.getByRole("img", { name: "Medalha Ouro" })).toBeVisible();
  await expect(reveal.locator(".rays-spin")).toHaveCount(1);
  await expect(reveal.getByRole("heading", { name: "Semana Ouro" })).toBeVisible();
  // O XP conta até o total.
  await expect(reveal.getByText("+450 XP", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(reveal.getByText("Subiu para o nível 2!")).toBeVisible();
  await expect(reveal.getByText("Melhor semana até agora")).toBeVisible();
  const bar = reveal.getByRole("progressbar", { name: "Nível 2" });
  await expect(bar).toHaveAttribute("aria-valuetext", "Nível 2, 250 de 360 XP");
  const stats = reveal.getByTestId("reveal-stats");
  await expect(stats).toContainText("9feitas");
  await expect(stats).toContainText("9altas");
  await expect(stats).toContainText("+350vs semana passada");
  // Foco dentro da janela, no botão principal.
  await expect(reveal.getByRole("button", { name: "Ver detalhes da semana" })).toBeFocused();
  await page.waitForTimeout(2200); // animações assentadas para a captura
  await page.screenshot({ path: `${SHOTS}/domingo-ouro-390x844.png` });

  await reveal.getByRole("button", { name: "Ver detalhes da semana" }).click();
  await expect(reveal).toHaveCount(0);
  const report = page.getByRole("dialog", { name: "Resumo da semana" });
  await expect(report).toBeVisible();
  const xp = report.getByTestId("report-xp");
  await expect(xp.getByRole("heading", { name: "Semana Ouro · 450 XP" })).toBeVisible();
  await expect(xp).toContainText("+350 XP vs semana passada");
  await expect(xp.getByRole("listitem").filter({ hasText: "Alta" })).toContainText("9 feitas · 450 XP");
  await expect(report.getByText("Não feitas (2)")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/domingo-report-390x844.png` });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${SHOTS}/domingo-report-dark-390x844.png` });
});

test("Supremo: fundo próprio, nível 4, e Esc fecha; barra do computador abre a revelação", async ({ page }) => {
  await openSunday(page, SUPREME);
  await page.getByRole("button", { name: /Sua semana fechou/ }).click();
  const reveal = page.getByRole("dialog", { name: "Medalha da semana" });
  await expect(reveal.getByRole("heading", { name: "Semana Suprema" })).toBeVisible();
  await expect(reveal.getByRole("img", { name: "Medalha Supremo" })).toBeVisible();
  await expect(reveal.getByText("+800 XP", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(reveal.getByText("Subiu para o nível 4!")).toBeVisible();
  await expect(reveal.getByText("Melhor semana até agora")).toBeVisible();
  await expect(reveal.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Nível 4, 258 de 518 XP");
  await expect(reveal.getByTestId("reveal-stats")).toContainText("16altas");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${SHOTS}/domingo-supremo-390x844.png` });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Computador: "Resumo da semana" na barra superior abre a revelação no domingo.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /^Resumo da semana/ }).click();
  await expect(reveal.getByRole("heading", { name: "Semana Suprema" })).toBeVisible();
  await page.waitForTimeout(2200);
  await page.screenshot({
    path: `${SHOTS}/domingo-supremo-1440x900.png`,
    scale: "css",
  });
});

test("Movimento reduzido: XP aparece direto; semana sem XP mostra a tela calma", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSunday(page, GOLD);
  await page.getByRole("button", { name: /Sua semana fechou/ }).click();
  const reveal = page.getByRole("dialog", { name: "Medalha da semana" });
  await expect(reveal.getByText("+450 XP", { exact: true })).toBeVisible({
    timeout: 300,
  });
  await reveal.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Semana sem medalha: sem raios, texto de incentivo, nível mantido", async ({ page }) => {
  await openSunday(page, EMPTY);
  const card = page.getByRole("button", { name: /Sua semana fechou/ });
  await expect(card).toContainText("Semana sem medalha");
  await card.click();
  const reveal = page.getByRole("dialog", { name: "Medalha da semana" });
  await expect(reveal.getByRole("heading", { name: "Semana sem medalha" })).toBeVisible();
  await expect(reveal.getByText(/amanhã começa uma semana nova/)).toBeVisible();
  await expect(reveal.locator(".rays-spin")).toHaveCount(0);
  await expect(reveal.getByText("Subiu para o nível", { exact: false })).toHaveCount(0);
  await expect(reveal.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Nível 4, 258 de 518 XP");
  await page.screenshot({ path: `${SHOTS}/domingo-sem-medalha-390x844.png` });
});
