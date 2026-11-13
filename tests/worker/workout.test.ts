import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";
import { addDays, todayISO, weekStart } from "../../shared/dates";

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
    env.DB.prepare("UPDATE workout_settings SET weekly_goal = 4, default_rest_s = 90, sound = 1"),
    env.DB.prepare("DELETE FROM tasks"),
  ]);
});

/** Uma quinta-feira fixa (semana de 2026-11-09). */
const THU = "2026-11-12";

async function makeTemplate(name = "Treino A", exercises = [{ name: "Supino Reto", sets: 2, reps: 8, weightG: 60000 }]) {
  const t = (await j(await call("POST", "/api/workout/templates", { name, focus: "Peito" }))).template;
  const ex = [];
  for (const e of exercises) ex.push((await j(await call("POST", `/api/workout/templates/${t.id}/exercises`, e))).exercise);
  return { t, ex };
}

/** Faz um treino inteiro no dia dado: abre, grava as séries e finaliza. */
async function doSession(templateId: string, exerciseId: string, date: string, sets: [number, number][]) {
  const s = (await j(await call("POST", "/api/workout/sessions", { templateId }, date))).session;
  const results = [];
  for (let i = 0; i < sets.length; i++) {
    const [weightG, reps] = sets[i];
    results.push(await j(await call("POST", `/api/workout/sessions/${s.id}/sets`, { exerciseId, setIndex: i + 1, weightG, reps })));
  }
  const fin = await call("POST", `/api/workout/sessions/${s.id}/finish`);
  return { session: s, results, summary: (await j(fin)).summary, finishStatus: fin.status };
}

describe("treinos e exercícios (CRUD)", () => {
  it("cria, edita, reordena e apaga", async () => {
    const res = await call("POST", "/api/workout/templates", { name: "  Treino A ", focus: "Peito" });
    expect(res.status).toBe(201);
    const t = (await j(res)).template;
    expect(t).toMatchObject({ name: "Treino A", focus: "Peito", position: 0, exercises: [] });

    const e1 = await call("POST", `/api/workout/templates/${t.id}/exercises`, { name: "Elevação Lateral", sets: 3, reps: 12, weightG: 10000 });
    expect(e1.status).toBe(201);
    const ex1 = (await j(e1)).exercise;
    expect(ex1).toMatchObject({ exerciseKey: "elevacao lateral", restS: 90, weightG: 10000, position: 0 });
    const ex2 = (await j(await call("POST", `/api/workout/templates/${t.id}/exercises`, { name: "Supino", sets: 4, reps: 8, weightG: 60000, restS: 120 }))).exercise;
    expect(ex2.position).toBe(1);

    // nome repetido (mesma chave) → 409
    const dup = await call("POST", `/api/workout/templates/${t.id}/exercises`, { name: "elevacao  LATERAL", sets: 3, reps: 12, weightG: 0 });
    expect(dup.status).toBe(409);

    // peso inválido → 400 com campo
    for (const weightG of [-500, 1250, 10.5]) {
      const bad = await call("POST", `/api/workout/templates/${t.id}/exercises`, { name: "X", sets: 3, reps: 8, weightG });
      expect(bad.status).toBe(400);
      expect((await j(bad)).fields.weightG).toBeTruthy();
    }

    const patched = await call("PATCH", `/api/workout/templates/${t.id}/exercises/${ex1.id}`, { restS: 60, weightG: 12500 });
    expect((await j(patched)).exercise).toMatchObject({ restS: 60, weightG: 12500 });

    const order = await call("PATCH", `/api/workout/templates/${t.id}/exercises/order`, { ids: [ex2.id, ex1.id] });
    expect(order.status).toBe(200);
    expect((await j(order)).template.exercises.map((e: any) => e.id)).toEqual([ex2.id, ex1.id]);
    expect((await call("PATCH", `/api/workout/templates/${t.id}/exercises/order`, { ids: [ex2.id] })).status).toBe(400);

    const tp = await call("PATCH", `/api/workout/templates/${t.id}`, { name: "Treino B", focus: null });
    expect((await j(tp)).template).toMatchObject({ name: "Treino B", focus: null });

    expect((await call("DELETE", `/api/workout/templates/${t.id}/exercises/${ex1.id}`)).status).toBe(200);
    expect((await call("DELETE", `/api/workout/templates/${t.id}/exercises/${ex1.id}`)).status).toBe(404);

    await call("PUT", "/api/workout/plan", { days: [{ weekday: 1, templateId: t.id }] });
    expect((await call("DELETE", `/api/workout/templates/${t.id}`)).status).toBe(200);
    const view = await j(await call("GET", "/api/workout", undefined, THU));
    expect(view.templates).toEqual([]);
    expect(view.plan[0]).toEqual({ weekday: 1, templateId: null });
    const gone = await call("PATCH", `/api/workout/templates/${t.id}`, { name: "x" });
    expect(gone.status).toBe(404);
    expect(await j(gone)).toEqual({ error: "Treino não encontrado." });
  });

  it("plano e configurações", async () => {
    const { t } = await makeTemplate();
    const res = await call("PUT", "/api/workout/plan", {
      days: [
        { weekday: 1, templateId: t.id },
        { weekday: 4, templateId: t.id },
      ],
      weeklyGoal: 3,
    });
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.plan).toHaveLength(7);
    expect(body.plan[3]).toEqual({ weekday: 4, templateId: t.id });
    expect(body.settings.weeklyGoal).toBe(3);
    expect((await call("PUT", "/api/workout/plan", { days: [{ weekday: 2, templateId: "nada" }] })).status).toBe(400);
    expect((await call("PUT", "/api/workout/plan", { days: [], weeklyGoal: 7 })).status).toBe(400);

    const s = await call("PATCH", "/api/workout/settings", { defaultRestS: 120, sound: false });
    expect((await j(s)).settings).toEqual({ weeklyGoal: 3, defaultRestS: 120, sound: false });
    expect((await call("PATCH", "/api/workout/settings", { defaultRestS: 601 })).status).toBe(400);
  });
});

describe("GET /api/workout", () => {
  it("semana com status, treino de hoje e meta", async () => {
    const { t, ex } = await makeTemplate();
    await call("PUT", "/api/workout/plan", {
      days: [
        { weekday: 1, templateId: t.id },
        { weekday: 3, templateId: t.id },
        { weekday: 4, templateId: t.id },
        { weekday: 6, templateId: t.id },
      ],
    });
    await doSession(t.id, ex[0].id, "2026-11-09", [[60000, 8], [60000, 8]]);
    const v = await j(await call("GET", "/api/workout", undefined, THU));
    expect(v).toMatchObject({ today: THU, week: "2026-11-09", weekNumber: 46, goal: 4, done: 1, medal: "bronze", openSession: null, streak: 0 });
    expect(v.days.map((d: any) => d.status)).toEqual(["done", "rest", "missed", "today", "rest", "future", "rest"]);
    expect(v.days[0].templateName).toBe("Treino A");
    expect(v.todayWorkout.template.id).toBe(t.id);
    expect(v.todayWorkout.exercises[0]).toMatchObject({
      name: "Supino Reto",
      suggestUp: true,
      last: { date: "2026-11-09", sets: [{ setIndex: 1, weightG: 60000, reps: 8 }, { setIndex: 2, weightG: 60000, reps: 8 }] },
    });
    expect(v.xp).toBe(2 * 5 + 50);
    expect(v.volumeG).toBe(60000 * 16);
    expect(v.nextMedal).toEqual({ medal: "prata", missingWorkouts: 1, missingPrs: 0 });

    const rest = await j(await call("GET", "/api/workout", undefined, "2026-11-10"));
    expect(rest.todayWorkout).toBeNull();
  });
});

describe("sessões", () => {
  it("409 com sessão aberta; continuar; descartar", async () => {
    const { t } = await makeTemplate();
    const first = await call("POST", "/api/workout/sessions", { templateId: t.id }, THU);
    expect(first.status).toBe(201);
    const s = (await j(first)).session;
    expect(s).toMatchObject({ date: THU, templateName: "Treino A", finishedAt: null, xp: 0 });
    expect(s.exercises[0].sets).toHaveLength(2);
    expect(s.exercises[0].sets[0]).toMatchObject({ setIndex: 1, prefill: { weightG: 60000, reps: 8 }, previous: null, done: null, pr: false });

    const dup = await call("POST", "/api/workout/sessions", { templateId: t.id }, THU);
    expect(dup.status).toBe(409);
    expect(await j(dup)).toEqual({ error: "Já existe um treino em andamento.", sessionId: s.id });

    const view = await j(await call("GET", "/api/workout", undefined, THU));
    expect(view.openSession).toMatchObject({ id: s.id, setsDone: 0 });
    expect((await call("GET", `/api/workout/sessions/${s.id}`)).status).toBe(200);

    expect((await call("POST", `/api/workout/sessions/${s.id}/finish`)).status).toBe(400); // sem séries
    expect((await call("DELETE", `/api/workout/sessions/${s.id}`)).status).toBe(200);
    expect((await call("GET", `/api/workout/sessions/${s.id}`)).status).toBe(404);
    expect((await call("POST", "/api/workout/sessions", { templateId: t.id }, THU)).status).toBe(201);
  });

  it("séries: XP, regravar, corrigir, apagar e finalizar", async () => {
    const { t, ex } = await makeTemplate();
    const s = (await j(await call("POST", "/api/workout/sessions", { templateId: t.id }, THU))).session;
    const path = `/api/workout/sessions/${s.id}/sets`;
    const r1 = await call("POST", path, { exerciseId: ex[0].id, setIndex: 1, weightG: 60000, reps: 8 });
    expect(r1.status).toBe(201);
    const b1 = await j(r1);
    expect(b1).toMatchObject({ xp: 5, pr: false, sessionXp: 5, set: { setIndex: 1, weightG: 60000, reps: 8, exerciseName: "Supino Reto" } });

    // reenvio da mesma série substitui (não duplica)
    const again = await j(await call("POST", path, { exerciseId: ex[0].id, setIndex: 1, weightG: 62500, reps: 8 }));
    expect(again).toMatchObject({ xp: 0, sessionXp: 5, set: { id: b1.set.id, weightG: 62500 } });

    expect((await call("POST", path, { exerciseId: "outro", setIndex: 1, weightG: 0, reps: 8 })).status).toBe(400);
    expect((await call("POST", path, { exerciseId: ex[0].id, setIndex: 1, weightG: 250, reps: 8 })).status).toBe(400);

    const b2 = await j(await call("POST", path, { exerciseId: ex[0].id, setIndex: 2, weightG: 60000, reps: 8 }));
    const fix = await call("PATCH", `${path}/${b2.set.id}`, { reps: 0 });
    expect(await j(fix)).toMatchObject({ set: { reps: 0 }, xp: -5, sessionXp: 5 });
    const del = await call("DELETE", `${path}/${b2.set.id}`);
    expect(await j(del)).toEqual({ id: b2.set.id, sessionXp: 5 });
    expect((await call("DELETE", `${path}/${b2.set.id}`)).status).toBe(404);

    const fin = await call("POST", `/api/workout/sessions/${s.id}/finish`);
    expect(fin.status).toBe(200);
    expect((await j(fin)).summary).toMatchObject({ sessionId: s.id, xp: 55, sets: 1, prs: 0, prevVolumeG: null });
    expect((await call("POST", `/api/workout/sessions/${s.id}/finish`)).status).toBe(409);
    expect((await call("POST", path, { exerciseId: ex[0].id, setIndex: 2, weightG: 0, reps: 8 })).status).toBe(409);
  });

  it("pré-preenchimento vem da última sessão (S1 com S1), senão do alvo", async () => {
    const { t, ex } = await makeTemplate("Treino A", [{ name: "Supino Reto", sets: 3, reps: 8, weightG: 60000 }]);
    await doSession(t.id, ex[0].id, "2026-11-09", [[80000, 8], [77500, 7]]);
    const s = (await j(await call("POST", "/api/workout/sessions", { templateId: t.id }, THU))).session;
    const e = s.exercises[0];
    expect(e.suggestUp).toBe(false); // só 2 de 3 séries, e S2 com 7 reps
    expect(e.last.date).toBe("2026-11-09");
    expect(e.sets.map((x: any) => x.prefill)).toEqual([
      { weightG: 80000, reps: 8 },
      { weightG: 77500, reps: 7 },
      { weightG: 60000, reps: 8 },
    ]);
    expect(e.sets[0].previous).toEqual({ weightG: 80000, reps: 8 });
    expect(e.sets[2].previous).toBeNull();
  });

  it("recorde: primeira vez não conta; +30 uma vez por exercício na sessão", async () => {
    const { t, ex } = await makeTemplate();
    const first = await doSession(t.id, ex[0].id, "2026-11-09", [[80000, 8], [80000, 8]]);
    expect(first.results.map((r: any) => r.pr)).toEqual([false, false]);
    expect(first.summary.prs).toBe(0);

    const second = await doSession(t.id, ex[0].id, THU, [[82500, 8], [85000, 6]]);
    expect(second.results.map((r: any) => [r.pr, r.xp])).toEqual([
      [true, 35],
      [true, 5],
    ]);
    expect(second.summary).toMatchObject({ prs: 1, xp: 10 + 50 + 30, prevVolumeG: 80000 * 16 });
    expect(second.summary.exercises[0]).toMatchObject({ trend: "up", maxG: 85000, prevMaxG: 80000, pr: true });

    const view = await j(await call("GET", `/api/workout/sessions/${second.session.id}`));
    expect(view.session.exercises[0].sets.map((x: any) => x.pr)).toEqual([true, true]);
  });
});

describe("GET /api/workout/report", () => {
  it("semana × semana anterior com X-Test-Today, conquistas e semanas", async () => {
    const { t, ex } = await makeTemplate();
    await doSession(t.id, ex[0].id, "2026-11-03", [[80000, 8], [80000, 8]]);
    await doSession(t.id, ex[0].id, THU, [[82500, 8], [82500, 8]]);

    const res = await call("GET", "/api/workout/report", undefined, THU);
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.report).toMatchObject({ week: "2026-11-09", previousWeek: "2026-11-02", improved: 1, compared: 1 });
    expect(body.report.exercises[0]).toMatchObject({ name: "Supino Reto", maxG: 82500, prevMaxG: 80000, deltaG: 2500 });
    expect(body.weeks).toEqual(["2026-11-09", "2026-11-02"]);
    expect(body.stats).toMatchObject({ totalPrs: 1, streak: 0, bestStreak: 0 });
    expect(body.achievements.find((a: any) => a.id === "recordista").unlocked).toBe(true);
    expect(body.achievements.find((a: any) => a.id === "tonelada").unlocked).toBe(false);

    const prev = await j(await call("GET", "/api/workout/report?week=2026-11-05", undefined, THU));
    expect(prev.report).toMatchObject({ week: "2026-11-02", compared: 0 });
    expect((await call("GET", "/api/workout/report?week=2026-02-30")).status).toBe(400);
  });
});

describe("XP do treino no nível geral", () => {
  it("/api/progress soma o XP do treino, sem mexer no XP/brasão das tarefas", async () => {
    const { t, ex } = await makeTemplate();
    const today = todayISO();
    await doSession(t.id, ex[0].id, today, [[60000, 8], [60000, 8]]);
    const p = await j(await call("GET", `/api/progress?start=${weekStart(today)}`));
    expect(p).toMatchObject({ totalXp: 60, weekXp: 0, medal: null });

    const task = (await j(await call("POST", "/api/tasks", { title: "t", date: addDays(weekStart(today), 1), difficulty: "low" }))).task;
    await call("PATCH", `/api/tasks/${task.id}`, { done: true });
    const p2 = await j(await call("GET", `/api/progress?start=${weekStart(today)}`));
    expect(p2).toMatchObject({ totalXp: 70, weekXp: 10, medal: "bronze" });
  });
});

describe("acesso", () => {
  it("host de produção sem Access → 401", async () => {
    const res = await app.request("https://agenda.test/api/workout", {}, { DB: env.DB, DEV: "true" } as any);
    expect(res.status).toBe(401);
  });
});
