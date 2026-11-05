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
    const body = (await (await call("GET", `/api/report?start=${START}`)).json()) as any;
    expect(body.report.percent).toBeNull();
    expect(body).toMatchObject({
      report: { xp: 0, medal: null, bestDay: null, byDifficulty: { low: 0, medium: 0, high: 0 } },
      previousXp: 0,
      bestWeekXp: 0,
      level: { level: 1, into: 0, needed: 300 },
      levelBefore: 1,
    });
  });
});

async function doneTask(date: string, difficulty: string) {
  const t = await create({ title: `${difficulty} ${date}`, date, difficulty });
  expect((await call("PATCH", `/api/tasks/${t.id}`, { done: true })).status).toBe(200);
}

/**
 * Semana anterior: 6 Altas (300) + 6 Altas no domingo (300, só nível) → 600 antes de START.
 * START: Alta + Baixa + Média feitas (85), uma Alta não feita, Alta no domingo (50).
 * Semana seguinte (a atual): Média feita (25).
 */
async function seedXp() {
  for (let i = 0; i < 6; i++) await doneTask(addDays(START, -7 + i), "high");
  for (let i = 0; i < 6; i++) await doneTask(addDays(START, -1), "high");
  await doneTask(START, "high");
  await doneTask(addDays(START, 1), "low");
  await doneTask(addDays(START, 1), "medium");
  await create({ title: "não feita", date: addDays(START, 2), difficulty: "high" });
  await doneTask(addDays(START, 6), "high");
  await doneTask(addDays(START, 7), "medium");
}

describe("XP no resumo e no progresso", () => {
  it("report: XP da semana, comparações e nível (domingo só no nível)", async () => {
    await seedXp();
    const body = (await (await call("GET", `/api/report?start=${addDays(START, 3)}`)).json()) as any;
    expect(body.report).toMatchObject({
      start: START,
      xp: 85,
      medal: "bronze",
      byDifficulty: { low: 1, medium: 1, high: 1 },
      bestDay: START,
    });
    expect(body.previousXp).toBe(300);
    expect(body.bestWeekXp).toBe(300);
    // 600 antes + 85 + 50 (domingo) = 735 → nível 3 (300 + 360 = 660), 75 dentro.
    expect(body.level).toEqual({ level: 3, into: 75, needed: 432 });
    expect(body.levelBefore).toBe(2);
  });

  it("progress: XP total com domingos, medalha só seg–sáb", async () => {
    await seedXp();
    const res = await call("GET", `/api/progress?start=${START}`);
    expect(res.status).toBe(200);
    // 600 + 85 + 50 + 25 = 760 → nível 3, 100 dentro.
    expect(await res.json()).toEqual({
      totalXp: 760,
      level: 3,
      into: 100,
      needed: 432,
      weekXp: 85,
      medal: "bronze",
      next: { medal: "prata", missing: 65 },
    });
    const prev = (await (await call("GET", `/api/progress?start=${addDays(START, -1)}`)).json()) as any;
    expect(prev).toMatchObject({ weekXp: 300, medal: "ouro", next: { medal: "diamante", missing: 200 } });
  });

  it("progress: só domingo não dá medalha; desmarcar remove o XP", async () => {
    const t = await create({ title: "dom", date: addDays(START, 6), difficulty: "high" });
    await call("PATCH", `/api/tasks/${t.id}`, { done: true });
    let p = (await (await call("GET", `/api/progress?start=${START}`)).json()) as any;
    expect(p).toMatchObject({ totalXp: 50, weekXp: 0, medal: null, next: { medal: "bronze", missing: 1 } });
    await call("PATCH", `/api/tasks/${t.id}`, { done: false });
    p = (await (await call("GET", `/api/progress?start=${START}`)).json()) as any;
    expect(p).toMatchObject({ totalXp: 0, level: 1, into: 0, needed: 300 });
  });

  it("progress: 400 sem start válido", async () => {
    expect((await call("GET", "/api/progress")).status).toBe(400);
    expect((await call("GET", "/api/progress?start=2026-02-30")).status).toBe(400);
  });
});

describe("rotas desconhecidas e erros", () => {
  it("/api/* inexistente devolve JSON 404", async () => {
    const res = await call("GET", "/api/nada");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Não encontrado." });
  });
});
