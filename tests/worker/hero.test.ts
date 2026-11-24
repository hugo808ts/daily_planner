import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const BASE = "http://localhost";
const call = (method: string, path: string, body?: unknown, today?: string) => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (today) headers["X-Test-Today"] = today;
  return SELF.fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};
const j = async (res: Response) => (await res.json()) as any;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM workout_sets"),
    env.DB.prepare("DELETE FROM workout_sessions"),
    env.DB.prepare("DELETE FROM workout_plan"),
    env.DB.prepare("DELETE FROM workout_exercises"),
    env.DB.prepare("DELETE FROM workout_templates"),
    env.DB.prepare("UPDATE workout_settings SET weekly_goal = 3, default_rest_s = 90, sound = 1"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM mission_checks"),
    env.DB.prepare("DELETE FROM missions"),
    env.DB.prepare("DELETE FROM finance_days"),
  ]);
});

/** Quinta-feira fixa (semana de 2026-11-09). */
const THU = "2026-11-12";
const MON = "2026-11-09";
const LAST_MON = "2026-11-02";

const hero = async (today = THU) => j(await call("GET", "/api/hero", undefined, today));

async function doneTask(title: string, date: string, area: string | null, difficulty = "high") {
  const t = (await j(await call("POST", "/api/tasks", { title, date, area, difficulty }))).task;
  await call("PATCH", `/api/tasks/${t.id}`, { done: true });
  // Feita no próprio dia (a partir de XP_DONE_AT_FROM o XP vale no dia de done_at).
  await env.DB.prepare("UPDATE tasks SET done_at = date || 'T15:00:00.000Z' WHERE id = ?").bind(t.id).run();
  return t;
}

async function workout(dates: string[]) {
  const t = (await j(await call("POST", "/api/workout/templates", { name: "Treino A", focus: "Peito" }))).template;
  const ex = (
    await j(await call("POST", `/api/workout/templates/${t.id}/exercises`, { name: "Supino", sets: 1, reps: 8, weightG: 60000 }))
  ).exercise;
  for (const date of dates) {
    const s = (await j(await call("POST", "/api/workout/sessions", { templateId: t.id }, date))).session;
    await call("POST", `/api/workout/sessions/${s.id}/sets`, { exerciseId: ex.id, setIndex: 1, weightG: 60000, reps: 8 });
    await call("POST", `/api/workout/sessions/${s.id}/finish`);
  }
}

async function mission(title: string, attribute: string, xp: number, today = MON) {
  return (await j(await call("POST", "/api/missions", { title, attribute, xp }, today))).mission;
}
const check = (id: string, date: string) => call("PUT", `/api/missions/${id}/checks/${date}`, { done: true }, THU);

const financeDays = (dates: string[]) =>
  env.DB.batch(dates.map((d) => env.DB.prepare("INSERT INTO finance_days (date, first_seen_at) VALUES (?, 'x')").bind(d)));

describe("GET /api/hero", () => {
  it("vazio: nível 1, Andarilho, torre só com o andar atual", async () => {
    const h = await hero();
    expect(h).toMatchObject({ today: THU, level: 1, totalXp: 0, stage: "andarilho", title: "Andarilho", dayStreak: 0 });
    expect(Object.keys(h.attributes)).toEqual(["fisica", "mental", "profissional", "espiritual", "financeira"]);
    expect(h.gear).toHaveLength(6);
    expect(h.tower).toHaveLength(1);
    expect(h.tower[0]).toMatchObject({ week: MON, current: true, medal: null });
  });

  it("Faculdade soma em Mental; Pessoal não soma em atributo, mas soma no nível", async () => {
    await doneTask("prova", MON, "school");
    await doneTask("mercado", MON, "personal");
    await doneTask("sem área", MON, null, "low");
    const h = await hero();
    expect(h.attributes.mental).toMatchObject({ xp: 50, sources: { tasks: 50 } });
    for (const a of ["fisica", "profissional", "espiritual", "financeira"]) expect(h.attributes[a].xp).toBe(0);
    expect(h.totalXp).toBe(110);
    expect(h.title).toBe("Aprendiz");
    expect(h.tower[0].medal).toBe("bronze");
  });

  it("treino soma em Física e a bandeira sobe com a meta", async () => {
    await workout([LAST_MON, "2026-11-04", "2026-11-06", MON]);
    const h = await hero();
    // 4 sessões × (5 da série + 50 da conclusão); sem recorde (mesmo peso).
    expect(h.attributes.fisica).toMatchObject({ xp: 220, sources: { workout: 220 } });
    expect(h.totalXp).toBe(220);
    expect(h.tower.map((f: any) => [f.week, f.trainFlag, f.current])).toEqual([
      [LAST_MON, true, false],
      [MON, false, true],
    ]);
  });

  it("finance_days soma em Financeira e no nível", async () => {
    await financeDays(["2026-10-01", "2026-10-02", MON]);
    const h = await hero();
    expect(h.attributes.financeira).toMatchObject({ xp: 30, sources: { finance: 30 } });
    expect(h.totalXp).toBe(30);
    expect(h.tower[0].week).toBe("2026-09-28");
    expect(h.tower.at(-1).current).toBe(true);
  });

  it("janela acesa só com todas as missões; sequência do dia", async () => {
    const a = await mission("Ler", "mental", 20, "2026-11-10");
    const b = await mission("Meditar", "espiritual", 10, "2026-11-10");
    await check(a.id, "2026-11-10");
    await check(a.id, "2026-11-11");
    await check(b.id, "2026-11-11");
    const h = await hero();
    expect(h.tower.at(-1).windows).toEqual(["dark", "dark", "lit", "today", "future", "future", "future"]);
    expect(h.tower.at(-1).litDays).toBe(1);
    expect(h.dayStreak).toBe(1);
    expect(h.attributes.mental.sources.missions).toBe(40);
    expect(h.attributes.espiritual.xp).toBe(10);
    expect(h.totalXp).toBe(50);
  });
});

describe("trilha e semana", () => {
  it("trilha com fontes em % e 404 para atributo desconhecido", async () => {
    await doneTask("prova", MON, "school");
    const m = await mission("Ler", "mental", 50);
    await check(m.id, MON);
    const t = await j(await call("GET", "/api/hero/trail/mental", undefined, THU));
    expect(t.attribute).toMatchObject({ id: "mental", xp: 100, sourcesPct: { tasks: 50, missions: 50, workout: 0, finance: 0 } });
    expect(t.nodes).toHaveLength(5);
    expect(t.nodes[0]).toMatchObject({ n: 1, done: true, unlockedOn: MON, reward: { kind: "title", label: "Aprendiz" } });
    expect(t.nodes[1]).toMatchObject({ reward: { kind: "gear", gear: "gibao" }, current: 1, target: 7, done: false });
    expect((await call("GET", "/api/hero/trail/pessoal")).status).toBe(404);
  });

  it("semana: andar, nós destravados e estágio antes/depois", async () => {
    await doneTask("prova", LAST_MON, "school");
    const w = await j(await call("GET", `/api/hero/week?start=2026-11-04`, undefined, THU));
    expect(w).toMatchObject({ start: LAST_MON, stageBefore: "andarilho", stageAfter: "andarilho" });
    expect(w.floor).toMatchObject({ week: LAST_MON, medal: "bronze", current: false });
    expect(w.unlocked.map((u: any) => [u.attribute, u.node.n])).toEqual([["mental", 1]]);
    const before = await j(await call("GET", `/api/hero/week?start=2026-10-05`, undefined, THU));
    expect(before.floor).toMatchObject({ week: "2026-10-05", medal: null });
    expect(before.unlocked).toEqual([]);
    expect((await call("GET", "/api/hero/week?start=2026-13-01")).status).toBe(400);
  });
});

describe("nível geral e brasão", () => {
  it("/api/progress inclui missões e finanças; brasão semanal igual ao de antes", async () => {
    await doneTask("trabalho", MON, "work");
    const before = await j(await call("GET", `/api/progress?start=${MON}`));
    const reportBefore = await j(await call("GET", `/api/report?start=${MON}`));
    expect(before).toMatchObject({ totalXp: 50, weekXp: 50, medal: "bronze" });

    const m = await mission("Ler", "mental", 35);
    await check(m.id, MON);
    await financeDays([MON, "2026-11-10"]);

    const after = await j(await call("GET", `/api/progress?start=${MON}`));
    expect(after).toMatchObject({ totalXp: 50 + 35 + 20, weekXp: 50, medal: "bronze" });
    const reportAfter = await j(await call("GET", `/api/report?start=${MON}`));
    expect(reportAfter.bestWeekXp).toBe(reportBefore.bestWeekXp);
    expect(reportAfter.previousXp).toBe(reportBefore.previousXp);
    expect(reportAfter.level.into).toBe(reportBefore.level.into + 55);
  });
});
