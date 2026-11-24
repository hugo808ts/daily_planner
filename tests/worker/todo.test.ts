import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayISO } from "../../shared/dates";

const BASE = "http://localhost";
const call = (method: string, path: string, body?: unknown) =>
  SELF.fetch(BASE + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const j = async (res: Response) => (await res.json()) as any;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM tasks").run();
});

describe("tarefas sem data", () => {
  it("cria sem data (ausente ou null) e não aparece na semana", async () => {
    const a = await call("POST", "/api/tasks", { title: "Comprar pilha" });
    expect(a.status).toBe(201);
    expect((await j(a)).task).toMatchObject({ title: "Comprar pilha", date: null, doneAt: null });
    const b = await call("POST", "/api/tasks", { title: "Ligar pro banco", date: null, time: null });
    expect((await j(b)).task.date).toBeNull();
    const week = await j(await call("GET", `/api/week?start=${todayISO()}`));
    expect(week.tasks).toEqual([]);
  });

  it("PATCH tira a data (null), põe de novo e mantém quando ausente", async () => {
    const t = (await j(await call("POST", "/api/tasks", { title: "Pagar conta", date: todayISO() }))).task;
    const off = (await j(await call("PATCH", `/api/tasks/${t.id}`, { date: null }))).task;
    expect(off.date).toBeNull();
    const kept = (await j(await call("PATCH", `/api/tasks/${t.id}`, { title: "Pagar luz" }))).task;
    expect(kept).toMatchObject({ title: "Pagar luz", date: null });
    const back = (await j(await call("PATCH", `/api/tasks/${t.id}`, { date: todayISO() }))).task;
    expect(back.date).toBe(todayISO());
    expect((await call("PATCH", `/api/tasks/${t.id}`, { date: "2026-02-30" })).status).toBe(400);
  });

  it("GET /api/todo: sem data pendentes, sem data feitas no dia e compromissos do dia", async () => {
    const today = todayISO();
    const create = async (body: object) => (await j(await call("POST", "/api/tasks", body))).task;
    const open = await create({ title: "Aberta" });
    const doneToday = await create({ title: "Feita hoje" });
    await call("PATCH", `/api/tasks/${doneToday.id}`, { done: true });
    const doneBefore = await create({ title: "Feita antes" });
    await env.DB.prepare("UPDATE tasks SET done_at = '2026-01-10T15:00:00.000Z' WHERE id = ?").bind(doneBefore.id).run();
    const appt = await create({ title: "Dentista", date: today, time: "15:00" });
    await create({ title: "Amanhã", date: addDays(today, 1) });

    const res = await call("GET", `/api/todo?date=${today}`);
    expect(res.status).toBe(200);
    const view = await j(res);
    expect(view.date).toBe(today);
    expect(view.undated.map((t: any) => t.id)).toEqual([open.id, doneToday.id]);
    expect(view.appointments.map((t: any) => t.id)).toEqual([appt.id]);

    expect((await call("GET", "/api/todo?date=2026-13-01")).status).toBe(400);
  });

  it("feita às 23h30 de São Paulo conta no dia local, não no UTC", async () => {
    const t = (await j(await call("POST", "/api/tasks", { title: "Tarde" }))).task;
    // 2026-11-25 02:30 UTC = 2026-11-24 23:30 em São Paulo.
    await env.DB.prepare("UPDATE tasks SET done_at = '2026-11-25T02:30:00.000Z' WHERE id = ?").bind(t.id).run();
    expect((await j(await call("GET", "/api/todo?date=2026-11-24"))).undated.map((x: any) => x.id)).toEqual([t.id]);
    expect((await j(await call("GET", "/api/todo?date=2026-11-25"))).undated).toEqual([]);
  });
});

describe("migração 0006", () => {
  it("recriar a tabela preserva as tarefas (ids, datas, feitas, dificuldade)", async () => {
    await env.DB.prepare(
      `INSERT INTO tasks (id, title, date, time, area, difficulty, done_at, moved_from_id, created_at, updated_at)
       VALUES ('a', 'Antiga', '2026-11-10', '09:00', 'work', 'high', '2026-11-10T12:00:00.000Z', NULL, 'c', 'u'),
              ('b', 'Cópia', '2026-11-11', NULL, NULL, 'low', NULL, 'a', 'c2', 'u2')`,
    ).run();
    const before = (await env.DB.prepare("SELECT * FROM tasks ORDER BY id").all()).results;
    const m = env.TEST_MIGRATIONS.find((x) => x.name.startsWith("0006"));
    expect(m).toBeDefined();
    await env.DB.batch(m!.queries.map((q) => env.DB.prepare(q)));
    const after = (await env.DB.prepare("SELECT * FROM tasks ORDER BY id").all()).results;
    expect(after).toEqual(before);
    const idx = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks' ORDER BY name").all<{ name: string }>();
    expect(idx.results.map((r) => r.name)).toEqual(expect.arrayContaining(["idx_tasks_date", "idx_tasks_undated"]));
  });
});

describe("XP no dia em que marca", () => {
  const progress = async (start: string) => j(await call("GET", `/api/progress?start=${start}`));
  it("semana antiga fica igual; a partir do corte conta na semana de done_at; sem data também", async () => {
    const create = async (body: object) => (await j(await call("POST", "/api/tasks", body))).task;
    const setDone = (id: string, at: string) => env.DB.prepare("UPDATE tasks SET done_at = ? WHERE id = ?").bind(at, id).run();
    // Tarefa de 2026-11-13 (sexta) marcada em 2026-11-17: antes do corte, fica na semana de 09/11.
    const old = await create({ title: "antiga", date: "2026-11-13", difficulty: "high" });
    await setDone(old.id, "2026-11-17T13:00:00.000Z");
    // Tarefa de 2026-11-21 (sábado) marcada em 2026-11-25: depois do corte, vai para a semana de 23/11.
    const late = await create({ title: "atrasada", date: "2026-11-21", difficulty: "low" });
    await setDone(late.id, "2026-11-25T13:00:00.000Z");
    // Sem data marcada na quinta 26/11.
    const free = await create({ title: "sem data" });
    await setDone(free.id, "2026-11-26T13:00:00.000Z");
    expect((await progress("2026-11-09")).weekXp).toBe(50);
    expect((await progress("2026-11-16")).weekXp).toBe(0);
    expect((await progress("2026-11-23")).weekXp).toBe(35);
    const rep = await j(await call("GET", "/api/report?start=2026-11-23"));
    expect(rep.report).toMatchObject({ done: 2, notDone: 0, xp: 35, bestDay: "2026-11-26" });
    expect((await j(await call("GET", "/api/report?start=2026-11-16"))).report).toMatchObject({ done: 0, notDone: 0 });
  });
});
