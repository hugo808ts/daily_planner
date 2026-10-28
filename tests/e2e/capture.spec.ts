import { expect, test, type Page } from "@playwright/test";
import { addDays, todayISO, weekDays, weekStart } from "../../shared/dates";
import { shortDay } from "../../src/lib/format";

// O servidor roda com DEV=true e AI_MOCK=rules: /api/capture usa só as regras, sem IA.
// Servidor e navegador usam o relógio real, então as datas são calculadas a partir de hoje.
const TODAY = todayISO();
const TOMORROW = addDays(TODAY, 1);
// Um dia futuro da semana visível depois de amanhã (para editar o chip de data).
const OTHER = weekDays(weekStart(TODAY)).find((d) => d > TOMORROW) ?? addDays(TODAY, 2);

const RELATORIO = "amanhã no trabalho tenho que apresentar o relatório pro gerente às 10";

const field = (page: Page) => page.getByRole("textbox", { name: "Captura rápida" });
const send = (page: Page) => page.getByRole("button", { name: "Enviar" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Confirmar captura" });

test.describe.configure({ mode: "serial" });

test("tarefa: escreve, confere os chips, troca o dia e salva", async ({ page }) => {
  await page.goto("/");

  await test.step("texto vazio deixa o botão de enviar desligado", async () => {
    await expect(field(page)).toBeVisible();
    await expect(send(page)).toBeDisabled();
    await field(page).fill("   ");
    await expect(send(page)).toBeDisabled();
  });

  await test.step("enviar abre a folha com o que foi entendido", async () => {
    await field(page).fill(RELATORIO);
    await expect(send(page)).toBeEnabled();
    await page.screenshot({ path: "test-results/capture-bar-390x844.png" });
    await send(page).click();
    const s = sheet(page);
    await expect(s).toBeVisible();
    await expect(s).toContainText(`“${RELATORIO}”`);
    await expect(s).toContainText("✓ Tarefa");
    await expect(s).toContainText("Apresentar o relatório pro gerente");
    await expect(s.getByRole("button", { name: /^Dia:/ })).toContainText(`Amanhã, ${shortDay(TOMORROW)}`);
    await expect(s.getByRole("button", { name: /^Horário:/ })).toContainText("10:00");
    await expect(s.getByRole("button", { name: /^Área:/ })).toContainText("Trabalho");
  });

  await page.waitForTimeout(300); // fim da animação de entrada da folha
  await page.screenshot({ path: "test-results/capture-sheet-390x844.png" });

  await test.step("editar o chip de data e salvar põe a tarefa naquele dia", async () => {
    const s = sheet(page);
    await s.getByRole("button", { name: /^Dia:/ }).click();
    await s.getByLabel("Dia", { exact: true }).fill(OTHER);
    await expect(s.getByRole("button", { name: /^Dia:/ })).toContainText(String(Number(OTHER.slice(8))));
    await s.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(s).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Tarefa salva");
    await expect(field(page)).toHaveValue("");

    await page.getByRole("navigation", { name: "Dias da semana" }).getByRole("button", { name: new RegExp(shortDay(OTHER).replace(" ", ".*")) }).click();
    const row = page.getByRole("listitem").filter({ hasText: "Apresentar o relatório pro gerente" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("10h");
  });
});

test("ideia sem pastas pede a primeira pasta e guarda nela", async ({ page, request }) => {
  const before = await (await request.get("/api/folders")).json();
  expect(before.folders).toHaveLength(0);

  await page.goto("/");
  await field(page).fill("ideia: testar revisão espaçada nas provas de cálculo");
  await field(page).press("Enter");

  const s = sheet(page);
  await expect(s).toBeVisible();
  await expect(s).toContainText("💡 Ideia");
  await expect(s).toContainText("Testar revisão espaçada nas provas de cálculo");
  await expect(s).toContainText("Crie sua primeira pasta");
  await expect(s.getByRole("button", { name: /^Dia:/ })).toHaveCount(0);

  await s.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(s.getByText("Dê um nome à pasta.")).toBeVisible();

  await s.getByLabel("Nome da pasta").fill("Estudos");
  await s.getByLabel("Emoji (opcional)").fill("📚");
  await s.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(s).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Ideia guardada");

  const { folders } = await (await request.get("/api/folders")).json();
  expect(folders).toHaveLength(1);
  expect(folders[0]).toMatchObject({ name: "Estudos", emoji: "📚" });
  const { ideas } = await (await request.get(`/api/folders/${folders[0].id}/ideas`)).json();
  expect(ideas.map((i: { title: string }) => i.title)).toEqual(["Testar revisão espaçada nas provas de cálculo"]);
});

test("trocar o tipo para ideia mostra a pasta e '+ Nova pasta'", async ({ page }) => {
  await page.goto("/");
  await field(page).fill("ligar pro dentista sexta");
  await send(page).click();
  const s = sheet(page);
  await s.getByRole("button", { name: /^Tipo:/ }).click();
  await expect(s).toContainText("💡 Ideia");
  await s.getByRole("button", { name: /^Pasta:/ }).click();
  await expect(s.getByRole("radio", { name: /Estudos/ })).toBeVisible();
  await expect(s.getByRole("button", { name: "+ Nova pasta" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(s).toBeHidden();
  await expect(field(page)).toHaveValue("ligar pro dentista sexta");
});

test("Ctrl+K foca o campo de captura", async ({ page }) => {
  await page.goto("/");
  await expect(field(page)).not.toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(field(page)).toBeFocused();
  await page.locator("h1").click();
  await page.keyboard.press("Meta+k");
  await expect(field(page)).toBeFocused();
});

/** Microfone e MediaRecorder falsos: o caminho de voz é testado sem hardware. */
async function fakeMic(page: Page, deny = false) {
  await page.addInitScript((deny) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (deny) throw new DOMException("negado", "NotAllowedError");
          return { getTracks: () => [{ stop() {} }] };
        },
      },
    });
    class FakeRecorder {
      static isTypeSupported = (t: string) => t === "audio/webm";
      state = "inactive";
      mimeType: string;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_s: unknown, opts?: { mimeType?: string }) {
        this.mimeType = opts?.mimeType ?? "audio/webm";
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(64)], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    (window as any).MediaRecorder = FakeRecorder;
  }, deny);
}

async function hold(page: Page, ms: number) {
  const mic = page.getByRole("button", { name: "Segure para falar" });
  await mic.hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test("voz: segurar o microfone transcreve e abre a confirmação", async ({ page }) => {
  await fakeMic(page);
  let calls = 0;
  let type = "";
  await page.route("**/api/transcribe", async (route) => {
    calls++;
    type = route.request().headers()["content-type"] ?? "";
    await route.fulfill({ json: { text: "comprar pão amanhã de manhã" } });
  });
  await page.goto("/");

  await test.step("toque curto (< 0,5 s) é descartado", async () => {
    // Dentro da página para o tempo não depender da latência do Playwright:
    // solta 50 ms depois de a gravação começar.
    await page.evaluate(async () => {
      const mic = document.querySelector<HTMLButtonElement>('[aria-label="Segure para falar"]')!;
      const opts = { bubbles: true, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 };
      mic.dispatchEvent(new PointerEvent("pointerdown", opts));
      while (!document.querySelector('[data-testid="recorder"]')) await new Promise((r) => setTimeout(r, 10));
      await new Promise((r) => setTimeout(r, 50));
      mic.dispatchEvent(new PointerEvent("pointerup", opts));
    });
    await expect(page.getByTestId("recorder")).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(calls).toBe(0);
  });

  await test.step("segurar mostra o tempo e, ao soltar, preenche e interpreta", async () => {
    const mic = page.getByRole("button", { name: "Segure para falar" });
    await mic.hover();
    await page.mouse.down();
    await expect(page.getByTestId("recorder")).toContainText("0:0");
    await page.waitForTimeout(700);
    await page.mouse.up();
    const s = sheet(page);
    await expect(s).toBeVisible();
    expect(calls).toBe(1);
    expect(type).toMatch(/^audio\/webm/);
    await expect(field(page)).toHaveValue("comprar pão amanhã de manhã");
    await expect(s).toContainText("Comprar pão");
    await expect(s.getByRole("button", { name: /^Horário:/ })).toContainText("09:00");
  });
});

test("voz: microfone negado mostra o aviso", async ({ page }) => {
  await fakeMic(page, true);
  await page.goto("/");
  await hold(page, 300);
  await expect(page.getByRole("status")).toContainText("Permita o microfone nos Ajustes do Safari.");
});
