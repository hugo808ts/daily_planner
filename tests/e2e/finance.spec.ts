import { expect, test, type Page } from "@playwright/test";
import fixture from "../fixtures/finance-snapshot.json" with { type: "json" };
import { HIDDEN_MONEY, money } from "../../src/lib/format";
import { openSection } from "./nav";

/** "Hoje" para o qual o retrato de exemplo foi montado (X-Test-Today só vale em DEV local). */
const TODAY = "2026-11-09";

const fakeServerToday = (page: Page) =>
  page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-test-today": TODAY } }));

test("Financeiro vazio: pede para o agente sincronizar", async ({ page }) => {
  await page.route("**/api/finance**", (route) => route.fulfill({ json: { empty: true } }));
  await page.goto("/");
  await openSection(page, "Financeiro");
  await expect(page.getByTestId("finance-empty")).toContainText("Peça ao Agente Finanças para sincronizar");
  await expect(page.getByRole("button", { name: /valores$/ })).toHaveCount(0);
});

test("Financeiro: patrimônio, categorias, contas fixas, olho e meses", async ({ page, request }) => {
  const res = await request.post("/api/finance/sync", { data: fixture });
  expect(res.status()).toBe(200);

  await fakeServerToday(page);
  await page.goto("/");
  await openSection(page, "Financeiro");
  await expect(page).toHaveURL(/#financeiro$/);

  const patrimonio = page.getByTestId("patrimonio");

  await test.step("patrimônio e mês atual", async () => {
    await expect(patrimonio).toHaveText(money(2_152_057));
    await expect(page.getByRole("heading", { name: "Mês de novembro" })).toBeVisible();
    await expect(page.getByRole("button", { name: "nov 2026" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("hoje · 9")).toBeVisible();
    await expect(page.getByTestId("projecao")).toHaveCount(1);
  });

  await test.step("categoria principal", async () => {
    await expect(page.getByTestId("categoria").first()).toContainText("Moradia");
  });

  await test.step("contas fixas: HOJE / AMANHÃ / N DIAS / dia N, nunca PAGO", async () => {
    const fixas = page.getByTestId("conta-fixa");
    await expect(fixas).toHaveCount(5); // a inativa não aparece
    await expect(fixas.filter({ hasText: "Streaming" })).toContainText("HOJE");
    await expect(fixas.filter({ hasText: "Academia" })).toContainText("AMANHÃ");
    await expect(fixas.filter({ hasText: "Internet" })).toContainText("6 DIAS");
    await expect(fixas.filter({ hasText: "Aluguel" })).toContainText("dia 5");
    await expect(page.getByText("PAGO", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("movimentacao")).toHaveCount(10);
  });

  await test.step("rodapé e menu mostram quando o agente sincronizou", async () => {
    await expect(page.getByText("Sincronizado pelo Agente Finanças hoje às 08:30")).toBeVisible();
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByText("Atualizado pelo agente às 08:30")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  await page.screenshot({ path: "test-results/financeiro.png", fullPage: true, animations: "disabled", scale: "css" });

  await test.step("olho esconde os valores e lembra a escolha", async () => {
    await page.getByRole("button", { name: "Esconder valores" }).click();
    const eye = page.getByRole("button", { name: "Mostrar valores" });
    await expect(eye).toHaveAttribute("aria-pressed", "true");
    await expect(patrimonio).toHaveText(HIDDEN_MONEY);
    await expect(page.getByText(/R\$\s?\d/)).toHaveCount(0);
    await expect(page.getByTestId("categoria").first()).toContainText("%"); // porcentagens continuam

    await page.reload();
    await expect(patrimonio).toHaveText(HIDDEN_MONEY);
    await page.getByRole("button", { name: "Mostrar valores" }).click();
    await expect(patrimonio).toHaveText(money(2_152_057));
  });

  await test.step("trocar de mês", async () => {
    await page.getByRole("button", { name: "out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mês de outubro" })).toBeVisible();
    await expect(page.getByRole("button", { name: "out 2026" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("31 out")).toBeVisible();
    await expect(page.getByTestId("projecao")).toHaveCount(0);
  });
});
