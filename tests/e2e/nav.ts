import { expect, type Page } from "@playwright/test";

/** Troca de tela pelo menu lateral: abre o ☰, toca no item e espera o menu fechar. */
export async function openSection(page: Page, name: "Tarefas do dia" | "Ideias" | "Treino" | "Financeiro") {
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(menu).toHaveCount(0);
}
