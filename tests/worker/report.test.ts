import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayISO, weekStart } from "../../shared/dates";

const BASE = "http://localhost";
const call = (method: string, path: string, body?: unknown) =>
  SELF.fetch(BASE + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM tasks"), env.DB.prepare("DELETE FROM day_notes")]);
});

// Semana passada inteira: tudo já fechou.
const START = addDays(weekStart(todayISO()), -7);

async function create(body: Record<string, unknown>) {
  return ((await (await call("POST", "/api/tasks", body)).json()) as any).task;
}

describe("GET /api/report", () => {
  it("400 para data inexistente ou ausente", async () => {
    expect((await call("GET", "/api/report?start=2026-13-01")).status).toBe(400);
    expect((await call("GET", "/api/report")).status).toBe(400);
  });

  it("caminho feliz: contagens, domingo fora e movedTo", async () => {
    const a = await create({ title: "feita", date: START });
    await call("PATCH", `/api/tasks/${a.id}`, { done: true });
    const b = await create({ title: "ficou", date: addDays(START, 1) });
    await create({ title: "ficou 2", date: addDays(START, 2) });
    await create({ title: "domingo", date: addDays(START, 6) });
    expect((await call("POST", `/api/tasks/${b.id}/move`, { date: todayISO() })).status).toBe(200);

    const res = await call("GET", `/api/report?start=${START}`);
    expect(res.status).toBe(200);
    const { report } = (await res.json()) as any;
    expect(report).toMatchObject({ start: START, end: addDays(START, 5), done: 1, notDone: 2, percent: 33 });
    const byTitle = Object.fromEntries(report.notDoneTasks.map((t: any) => [t.title, t]));
    expect(byTitle["ficou"].movedTo).toBe(true);
    expect(byTitle["ficou 2"].movedTo).toBeUndefined();
  });

  it("semana vazia: percent null", async () => {
    const { report } = (await (await call("GET", `/api/report?start=${START}`)).json()) as any;
    expect(report.percent).toBeNull();
  });
});

describe("rotas desconhecidas e erros", () => {
  it("/api/* inexistente devolve JSON 404", async () => {
    const res = await call("GET", "/api/nada");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Não encontrado." });
  });
});
