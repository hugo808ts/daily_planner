import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/finance-snapshot.json";
import { financeDaysFrom } from "../../shared/hero";

const BASE = "http://localhost";
/** "Hoje" para o qual o retrato de exemplo foi montado (X-Test-Today só vale em DEV local). */
const TODAY = "2026-11-09";

const sync = (body: string, headers: Record<string, string> = { "Content-Type": "application/json" }) =>
  SELF.fetch(`${BASE}/api/finance/sync`, { method: "POST", headers, body });
const get = (query = "") => SELF.fetch(`${BASE}/api/finance${query}`, { headers: { "X-Test-Today": TODAY } });
const j = async (res: Response) => (await res.json()) as any;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM finance_snapshot").run();
});

describe("GET /api/finance", () => {
  it("vazio antes da primeira sincronização", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await j(res)).toEqual({ empty: true });
  });

  it("400 com mês inválido", async () => {
    for (const q of ["?month=2026-13", "?month=2026-1", "?month="]) {
      const res = await get(q);
      expect(res.status).toBe(400);
      expect((await j(res)).fields).toEqual({ month: "Mês inválido (use AAAA-MM)." });
    }
  });
});

describe("POST /api/finance/sync", () => {
  it("grava o retrato e o GET devolve tudo calculado", async () => {
    const res = await sync(JSON.stringify(fixture));
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body).toMatchObject({ ok: true, generatedAt: fixture.generatedAt });
    expect(typeof body.receivedAt).toBe("string");

    const v = await j(await get());
    expect(v).toMatchObject({ empty: false, month: "2026-11", today: TODAY, generatedAt: fixture.generatedAt, receivedAt: body.receivedAt });
    expect(v.patrimonio).toEqual({ total: 2_152_057, contas: 1_046_567, investido: 1_105_490 });
    expect(v.mes).toMatchObject({ entrou: 465_000, saiu: 191_568, sobra: 273_432, projecao: 638_560 });
    expect(v.categorias[0].categoria).toBe("Moradia");
    expect(v.contasFixas[0]).toMatchObject({ descricao: "Streaming", rotulo: "HOJE" });
    expect(v.meses).toEqual(["2026-11", "2026-10"]);
    expect(v.movimentacoes).toHaveLength(10);

    const out = await j(await get("?month=2026-10"));
    expect(out.mes).toMatchObject({ saiu: 223_769, projecao: null });
  });

  it("substitui o retrato anterior (uma linha só)", async () => {
    await sync(JSON.stringify(fixture));
    const novo = { ...fixture, generatedAt: "2026-11-09T09:00-03:00", contas: [] };
    expect((await sync(JSON.stringify(novo))).status).toBe(200);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM finance_snapshot").first<{ n: number }>();
    expect(n?.n).toBe(1);
    const v = await j(await get());
    expect(v.generatedAt).toBe("2026-11-09T09:00-03:00");
    expect(v.patrimonio.contas).toBe(0);
  });

  it("400 com os campos inválidos", async () => {
    const bad = structuredClone(fixture) as any;
    bad.contas[0].saldo = 12.5;
    bad.movimentacoes[1].data = "2026-02-30";
    const res = await sync(JSON.stringify(bad));
    expect(res.status).toBe(400);
    const body = await j(res);
    expect(body.error).toBe("Retrato inválido.");
    expect(body.fields["contas.0.saldo"]).toBe("Use centavos inteiros.");
    expect(body.fields["movimentacoes.1.data"]).toBe("Data inválida (use AAAA-MM-DD).");
    const empty = await j(await get());
    expect(empty).toEqual({ empty: true });
  });

  it("exige JSON", async () => {
    expect((await sync(JSON.stringify(fixture), { "Content-Type": "text/plain" })).status).toBe(400);
    const res = await sync("{nao-e-json");
    expect(res.status).toBe(400);
    expect((await j(res)).error).toBe("JSON inválido.");
  });

  it("413 acima de 2 MB", async () => {
    const big = JSON.stringify({ ...fixture, lixo: "x".repeat(2 * 1024 * 1024) });
    const res = await sync(big);
    expect(res.status).toBe(413);
    expect((await j(res)).error).toBe("Retrato grande demais (máximo de 2 MB).");
  });

  it("413 também sem Content-Length (corpo em stream)", async () => {
    const chunk = new TextEncoder().encode("x".repeat(256 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        if (sent++ < 10) ctrl.enqueue(chunk);
        else ctrl.close();
      },
    });
    const res = await SELF.fetch(`${BASE}/api/finance/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
    });
    expect(res.status).toBe(413);
  });
});

describe("dias de finanças do Herói", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM finance_days").run();
  });

  const days = async () =>
    (await env.DB.prepare("SELECT date FROM finance_days ORDER BY date").all<{ date: string }>()).results.map((r) => r.date);

  it("o sync grava as datas e um segundo sync com menos meses não apaga", async () => {
    expect((await sync(JSON.stringify(fixture))).status).toBe(200);
    const all = financeDaysFrom(fixture as any);
    expect(all.length).toBeGreaterThan(1);
    expect(await days()).toEqual(all);

    const menor = { ...fixture, movimentacoes: fixture.movimentacoes.filter((m) => m.data >= all[all.length - 1]) };
    expect((await sync(JSON.stringify(menor))).status).toBe(200);
    expect(await days()).toEqual(all);
  });

  it("ignora transferência e ajuste", async () => {
    const mov = fixture.movimentacoes[0];
    const snap = {
      ...fixture,
      movimentacoes: [
        { ...mov, id: 1, data: "2026-01-05", tipo: "transferencia" },
        { ...mov, id: 2, data: "2026-01-06", tipo: "ajuste" },
        { ...mov, id: 3, data: "2026-01-07", tipo: "gasto" },
      ],
    };
    expect((await sync(JSON.stringify(snap))).status).toBe(200);
    expect(await days()).toEqual(["2026-01-07"]);
  });
});
