import { Hono } from "hono";
import { isRealDate, weekDays, weekStart } from "../../shared/dates";
import { WORKOUT_EXERCISES_MAX, WORKOUT_TEMPLATES_MAX } from "../../shared/limits";
import {
  achievements,
  bestStreak,
  buildSessionSummary,
  buildWeekReport,
  doneByWeek,
  exerciseKey,
  isoWeekday,
  isoWeekNumber,
  isPerfectWeek,
  lastTimeByKey,
  prefill,
  priorMaxes,
  shouldSuggestUp,
  startedEarly,
  streakWeeks,
  volumeOf,
  workoutMedal,
  workoutNextMedal,
  WorkoutExerciseCreate,
  WorkoutExerciseOrder,
  WorkoutExercisePatch,
  WorkoutPlanPut,
  WorkoutSessionStart,
  WorkoutSetCreate,
  WorkoutSetPatch,
  WorkoutSettingsPatch,
  WorkoutTemplateCreate,
  WorkoutTemplatePatch,
  type OpenSessionInfo,
  type SessionExercise,
  type SessionView,
  type SetResult,
  type WorkoutDay,
  type WorkoutExercise,
  type WorkoutReportResponse,
  type WorkoutSet,
  type WorkoutWeekView,
} from "../../shared/workout";
import { badRequest, readBody, serverToday, type Ctx } from "../http";
import type { Env } from "../index";
import {
  getPlan,
  getSession,
  getSettings,
  getTemplate,
  listTemplates,
  loadHistory,
  rowToExercise,
  rowToSet,
  type ExerciseRow,
  type SetRow,
  type WorkoutHistory,
  type WorkoutSession,
} from "../workout-db";
import { workoutXpBySession } from "../xp";

const notFound = (c: Ctx, what: string) => c.json({ error: `${what} não encontrado.` }, 404);
const TEMPLATE = "Treino";
const EXERCISE = "Exercício";
const SESSION = "Treino em andamento";
const SET = "Série";

export const workoutRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Visão da semana
// ---------------------------------------------------------------------------

workoutRoutes.get("/api/workout", async (c) => {
  const db = c.env.DB;
  const today = serverToday(c);
  const week = weekStart(today);
  const [templates, settings, plan, history] = await Promise.all([
    listTemplates(db),
    getSettings(db),
    getPlan(db),
    loadHistory(db),
  ]);
  const xps = workoutXpBySession(history);
  const inWeek = history.sessions.filter((s) => weekStart(s.date) === week);
  const inWeekIds = new Set(inWeek.map((s) => s.id));
  const finishedOn = new Map<string, string>();
  for (const s of inWeek) if (s.finishedAt) finishedOn.set(s.date, s.id);
  const byId = new Map(templates.map((t) => [t.id, t]));

  const days: WorkoutDay[] = weekDays(week).map((date, i) => {
    const templateId = plan[i].templateId;
    const sessionId = finishedOn.get(date) ?? null;
    const status: WorkoutDay["status"] = sessionId
      ? "done"
      : !templateId
        ? "rest"
        : date < today
          ? "missed"
          : date === today
            ? "today"
            : "future";
    return { date, weekday: i + 1, templateId, templateName: byId.get(templateId ?? "")?.name ?? null, status, sessionId };
  });

  const open = history.sessions.find((s) => !s.finishedAt) ?? null;
  const pastSessions = history.sessions.filter((s) => s !== open);
  const last = lastTimeByKey(pastSessions, history.sets);
  const todayTemplate = byId.get(plan[isoWeekday(today) - 1].templateId ?? "");
  const todayWorkout = todayTemplate
    ? {
        template: todayTemplate,
        exercises: todayTemplate.exercises.map((e) => {
          const lt = last.get(e.exerciseKey) ?? null;
          return { ...e, last: lt, suggestUp: shouldSuggestUp(lt?.sets, e) };
        }),
      }
    : null;

  const goal = settings.weeklyGoal;
  const done = finishedOn.size;
  const prs = inWeek.reduce((n, s) => n + (xps.get(s.id)?.prs.size ?? 0), 0);
  const openSession: OpenSessionInfo | null = open
    ? {
        id: open.id,
        templateId: open.templateId,
        templateName: open.templateName,
        date: open.date,
        startedAt: open.startedAt,
        setsDone: history.sets.filter((s) => s.sessionId === open.id).length,
      }
    : null;
  const view: WorkoutWeekView = {
    today,
    week,
    weekNumber: isoWeekNumber(today),
    settings,
    templates,
    plan,
    days,
    todayWorkout,
    goal,
    done,
    volumeG: volumeOf(history.sets.filter((s) => inWeekIds.has(s.sessionId))),
    xp: inWeek.reduce((n, s) => n + (xps.get(s.id)?.xp ?? 0), 0),
    prs,
    openSession,
    streak: streakWeeks(doneByWeek(history.sessions), goal, week),
    medal: workoutMedal(done, goal, prs),
    nextMedal: workoutNextMedal(done, goal, prs),
  };
  return c.json(view);
});

// ---------------------------------------------------------------------------
// Treinos (A/B/C) e exercícios
// ---------------------------------------------------------------------------

workoutRoutes.post("/api/workout/templates", async (c) => {
  const body = await readBody(c, WorkoutTemplateCreate);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const stats = await db
    .prepare("SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS maxPos FROM workout_templates")
    .first<{ n: number; maxPos: number }>();
  if ((stats?.n ?? 0) >= WORKOUT_TEMPLATES_MAX) {
    return c.json({ error: `No máximo ${WORKOUT_TEMPLATES_MAX} treinos.` }, 409);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO workout_templates (id, name, focus, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, body.data.name, body.data.focus || null, (stats?.maxPos ?? -1) + 1, now, now)
    .run();
  return c.json({ template: await getTemplate(db, id) }, 201);
});

workoutRoutes.patch("/api/workout/templates/:id", async (c) => {
  const body = await readBody(c, WorkoutTemplatePatch);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const t = await getTemplate(db, c.req.param("id"));
  if (!t) return notFound(c, TEMPLATE);
  const p = body.data;
  await db
    .prepare("UPDATE workout_templates SET name = ?, focus = ?, position = ?, updated_at = ? WHERE id = ?")
    .bind(
      p.name ?? t.name,
      p.focus === undefined ? t.focus : p.focus || null,
      p.position ?? t.position,
      new Date().toISOString(),
      t.id,
    )
    .run();
  return c.json({ template: await getTemplate(db, t.id) });
});

workoutRoutes.delete("/api/workout/templates/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  // As FKs já fazem isso; explícito para não depender de PRAGMA foreign_keys.
  const [, , , del] = await db.batch([
    db.prepare("UPDATE workout_plan SET template_id = NULL WHERE template_id = ?").bind(id),
    db.prepare("UPDATE workout_sessions SET template_id = NULL WHERE template_id = ?").bind(id),
    db.prepare("DELETE FROM workout_exercises WHERE template_id = ?").bind(id),
    db.prepare("DELETE FROM workout_templates WHERE id = ?").bind(id),
  ]);
  if (!del.meta.changes) return notFound(c, TEMPLATE);
  return c.json({ id });
});

async function getExercise(db: D1Database, templateId: string, id: string): Promise<WorkoutExercise | null> {
  const r = await db
    .prepare("SELECT * FROM workout_exercises WHERE id = ? AND template_id = ?")
    .bind(id, templateId)
    .first<ExerciseRow>();
  return r ? rowToExercise(r) : null;
}

const duplicateExercise = (c: Ctx) =>
  c.json({ error: "Este treino já tem esse exercício.", fields: { name: "Exercício repetido." } }, 409);

workoutRoutes.post("/api/workout/templates/:id/exercises", async (c) => {
  const body = await readBody(c, WorkoutExerciseCreate);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const t = await getTemplate(db, c.req.param("id"));
  if (!t) return notFound(c, TEMPLATE);
  if (t.exercises.length >= WORKOUT_EXERCISES_MAX) {
    return c.json({ error: `No máximo ${WORKOUT_EXERCISES_MAX} exercícios por treino.` }, 409);
  }
  const key = exerciseKey(body.data.name);
  if (t.exercises.some((e) => e.exerciseKey === key)) return duplicateExercise(c);
  const settings = await getSettings(db);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const position = t.exercises.reduce((m, e) => Math.max(m, e.position), -1) + 1;
  await db
    .prepare(
      `INSERT INTO workout_exercises (id, template_id, name, exercise_key, position, sets, reps, weight_g, rest_s, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      t.id,
      body.data.name,
      key,
      position,
      body.data.sets,
      body.data.reps,
      body.data.weightG,
      body.data.restS ?? settings.defaultRestS,
      now,
      now,
    )
    .run();
  return c.json({ exercise: await getExercise(db, t.id, id) }, 201);
});

// Registrada antes de /:eid para "order" não virar um id.
workoutRoutes.patch("/api/workout/templates/:id/exercises/order", async (c) => {
  const body = await readBody(c, WorkoutExerciseOrder);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const t = await getTemplate(db, c.req.param("id"));
  if (!t) return notFound(c, TEMPLATE);
  const ids = body.data.ids;
  const current = new Set(t.exercises.map((e) => e.id));
  if (ids.length !== current.size || new Set(ids).size !== ids.length || !ids.every((i) => current.has(i))) {
    return badRequest(c, "Envie todos os exercícios do treino, sem repetir.", { ids: "Lista de exercícios inválida." });
  }
  const now = new Date().toISOString();
  if (ids.length) {
    await db.batch(
      ids.map((eid, i) =>
        db.prepare("UPDATE workout_exercises SET position = ?, updated_at = ? WHERE id = ?").bind(i, now, eid),
      ),
    );
  }
  return c.json({ template: await getTemplate(db, t.id) });
});

workoutRoutes.patch("/api/workout/templates/:id/exercises/:eid", async (c) => {
  const body = await readBody(c, WorkoutExercisePatch);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const templateId = c.req.param("id");
  const e = await getExercise(db, templateId, c.req.param("eid"));
  if (!e) return notFound(c, EXERCISE);
  const p = body.data;
  const name = p.name ?? e.name;
  const key = exerciseKey(name);
  if (key !== e.exerciseKey) {
    const clash = await db
      .prepare("SELECT 1 AS x FROM workout_exercises WHERE template_id = ? AND exercise_key = ? AND id <> ?")
      .bind(templateId, key, e.id)
      .first();
    if (clash) return duplicateExercise(c);
  }
  await db
    .prepare(
      "UPDATE workout_exercises SET name = ?, exercise_key = ?, sets = ?, reps = ?, weight_g = ?, rest_s = ?, updated_at = ? WHERE id = ?",
    )
    .bind(name, key, p.sets ?? e.sets, p.reps ?? e.reps, p.weightG ?? e.weightG, p.restS ?? e.restS, new Date().toISOString(), e.id)
    .run();
  return c.json({ exercise: await getExercise(db, templateId, e.id) });
});

workoutRoutes.delete("/api/workout/templates/:id/exercises/:eid", async (c) => {
  const eid = c.req.param("eid");
  const res = await c.env.DB.prepare("DELETE FROM workout_exercises WHERE id = ? AND template_id = ?")
    .bind(eid, c.req.param("id"))
    .run();
  if (!res.meta.changes) return notFound(c, EXERCISE);
  return c.json({ id: eid });
});

// ---------------------------------------------------------------------------
// Semana fixa e configurações
// ---------------------------------------------------------------------------

workoutRoutes.put("/api/workout/plan", async (c) => {
  const body = await readBody(c, WorkoutPlanPut);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const ids = [...new Set(body.data.days.map((d) => d.templateId).filter((x): x is string => !!x))];
  if (ids.length) {
    const { results } = await db
      .prepare(`SELECT id FROM workout_templates WHERE id IN (${ids.map(() => "?").join(",")})`)
      .bind(...ids)
      .all<{ id: string }>();
    if (results.length !== ids.length) return badRequest(c, "Treino não encontrado.", { days: "Treino não encontrado." });
  }
  const stmts = body.data.days.map((d) =>
    db
      .prepare(
        "INSERT INTO workout_plan (weekday, template_id) VALUES (?, ?) ON CONFLICT(weekday) DO UPDATE SET template_id = excluded.template_id",
      )
      .bind(d.weekday, d.templateId),
  );
  if (body.data.weeklyGoal !== undefined) {
    stmts.push(db.prepare("UPDATE workout_settings SET weekly_goal = ? WHERE id = 1").bind(body.data.weeklyGoal));
  }
  if (stmts.length) await db.batch(stmts);
  const [plan, settings] = await Promise.all([getPlan(db), getSettings(db)]);
  return c.json({ plan, settings });
});

workoutRoutes.patch("/api/workout/settings", async (c) => {
  const body = await readBody(c, WorkoutSettingsPatch);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const s = await getSettings(db);
  const p = body.data;
  await db
    .prepare(
      `INSERT INTO workout_settings (id, weekly_goal, default_rest_s, sound) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET weekly_goal = excluded.weekly_goal, default_rest_s = excluded.default_rest_s, sound = excluded.sound`,
    )
    .bind(p.weeklyGoal ?? s.weeklyGoal, p.defaultRestS ?? s.defaultRestS, (p.sound ?? s.sound) ? 1 : 0)
    .run();
  return c.json({ settings: await getSettings(db) });
});

// ---------------------------------------------------------------------------
// Sessões (treino ao vivo)
// ---------------------------------------------------------------------------

/** XP da sessão e os exercícios com recorde nela. */
function sessionStats(h: WorkoutHistory, sessionId: string): { xp: number; prs: Set<string> } {
  return workoutXpBySession(h).get(sessionId) ?? { xp: 0, prs: new Set() };
}

/** Sessão com exercícios do treino (ordem atual), séries feitas, pré-preenchimento e recordes. */
async function buildSessionView(db: D1Database, session: WorkoutSession, h?: WorkoutHistory): Promise<SessionView> {
  const history = h ?? (await loadHistory(db));
  const template = session.templateId ? await getTemplate(db, session.templateId) : null;
  const idx = history.sessions.findIndex((s) => s.id === session.id);
  const before = history.sessions.slice(0, Math.max(0, idx));
  const last = lastTimeByKey(before, history.sets);
  const prior = priorMaxes(history.sessions, history.sets, session.id);
  const mine = history.sets.filter((s) => s.sessionId === session.id);

  const slotsFor = (
    key: string,
    target: Pick<WorkoutExercise, "sets" | "reps" | "weightG">,
  ): SessionExercise["sets"] => {
    const lt = last.get(key);
    const done = mine.filter((s) => s.exerciseKey === key);
    const count = Math.max(target.sets, ...done.map((s) => s.setIndex));
    return Array.from({ length: count }, (_, i) => {
      const setIndex = i + 1;
      const d = done.find((s) => s.setIndex === setIndex) ?? null;
      const p = prefill(lt?.sets, target, setIndex);
      const prev = lt?.sets.find((s) => s.setIndex === setIndex);
      const max = prior.get(key);
      return {
        setIndex,
        prefill: { weightG: p.weightG, reps: p.reps },
        previous: prev ? { weightG: prev.weightG, reps: prev.reps } : null,
        done: d,
        pr: !!d && d.reps >= 1 && max !== undefined && d.weightG > max,
      };
    });
  };

  const exercises: SessionExercise[] = (template?.exercises ?? []).map((e) => {
    const lt = last.get(e.exerciseKey) ?? null;
    return {
      exerciseId: e.id,
      name: e.name,
      exerciseKey: e.exerciseKey,
      position: e.position,
      targetSets: e.sets,
      targetReps: e.reps,
      targetWeightG: e.weightG,
      restS: e.restS,
      suggestUp: shouldSuggestUp(lt?.sets, e),
      last: lt,
      sets: slotsFor(e.exerciseKey, e),
    };
  });
  // Séries de exercícios que saíram do treino depois de feitas.
  const known = new Set(exercises.map((e) => e.exerciseKey));
  for (const s of mine) {
    if (known.has(s.exerciseKey)) continue;
    known.add(s.exerciseKey);
    const target = { sets: 0, reps: s.reps, weightG: s.weightG };
    exercises.push({
      exerciseId: null,
      name: s.exerciseName,
      exerciseKey: s.exerciseKey,
      position: s.exercisePosition,
      targetSets: 0,
      targetReps: s.reps,
      targetWeightG: s.weightG,
      restS: 0,
      suggestUp: false,
      last: last.get(s.exerciseKey) ?? null,
      sets: slotsFor(s.exerciseKey, target),
    });
  }
  return {
    id: session.id,
    date: session.date,
    templateId: session.templateId,
    templateName: session.templateName,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    xp: sessionStats(history, session.id).xp,
    exercises,
  };
}

const openConflict = (c: Ctx, sessionId: string) =>
  c.json({ error: "Já existe um treino em andamento.", sessionId }, 409);
const finishedConflict = (c: Ctx) => c.json({ error: "Este treino já foi finalizado." }, 409);

workoutRoutes.post("/api/workout/sessions", async (c) => {
  const body = await readBody(c, WorkoutSessionStart);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const open = await db.prepare("SELECT id FROM workout_sessions WHERE finished_at IS NULL LIMIT 1").first<{ id: string }>();
  if (open) return openConflict(c, open.id);
  const t = await getTemplate(db, body.data.templateId);
  if (!t) return notFound(c, TEMPLATE);
  if (!t.exercises.length) return badRequest(c, "Este treino não tem exercícios.");
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        "INSERT INTO workout_sessions (id, date, template_id, template_name, started_at, finished_at) VALUES (?, ?, ?, ?, ?, NULL)",
      )
      .bind(id, serverToday(c), t.id, t.name, new Date().toISOString())
      .run();
  } catch {
    // Índice único de sessão aberta: outra aba abriu ao mesmo tempo.
    const other = await db.prepare("SELECT id FROM workout_sessions WHERE finished_at IS NULL LIMIT 1").first<{ id: string }>();
    if (other) return openConflict(c, other.id);
    throw new Error("Falha ao abrir a sessão.");
  }
  const session = (await getSession(db, id))!;
  return c.json({ session: await buildSessionView(db, session) }, 201);
});

workoutRoutes.get("/api/workout/sessions/:id", async (c) => {
  const session = await getSession(c.env.DB, c.req.param("id"));
  if (!session) return notFound(c, SESSION);
  return c.json({ session: await buildSessionView(c.env.DB, session) });
});

async function getSet(db: D1Database, sessionId: string, id: string): Promise<WorkoutSet | null> {
  const r = await db
    .prepare("SELECT * FROM workout_sets WHERE id = ? AND session_id = ?")
    .bind(id, sessionId)
    .first<SetRow>();
  return r ? rowToSet(r) : null;
}

/** A série bate o recorde (comparada com as sessões anteriores a esta). */
function setIsPr(h: WorkoutHistory, set: WorkoutSet): boolean {
  const max = priorMaxes(h.sessions, h.sets, set.sessionId).get(set.exerciseKey);
  return set.reps >= 1 && max !== undefined && set.weightG > max;
}

workoutRoutes.post("/api/workout/sessions/:id/sets", async (c) => {
  const body = await readBody(c, WorkoutSetCreate);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const session = await getSession(db, c.req.param("id"));
  if (!session) return notFound(c, SESSION);
  if (session.finishedAt) return finishedConflict(c);
  if (!session.templateId) return c.json({ error: "O treino desta sessão foi apagado." }, 409);
  const e = await getExercise(db, session.templateId, body.data.exerciseId);
  if (!e) return badRequest(c, "Exercício não faz parte deste treino.", { exerciseId: "Exercício inválido." });

  const xpBefore = sessionStats(await loadHistory(db), session.id).xp;
  const now = new Date().toISOString();
  // Mesma série de novo (ex.: reenvio depois de falha de rede) substitui a anterior.
  await db
    .prepare(
      `INSERT INTO workout_sets (id, session_id, exercise_key, exercise_name, exercise_position, set_index, weight_g, reps, done_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, exercise_key, set_index) DO UPDATE SET
         exercise_name = excluded.exercise_name, exercise_position = excluded.exercise_position,
         weight_g = excluded.weight_g, reps = excluded.reps, done_at = excluded.done_at`,
    )
    .bind(crypto.randomUUID(), session.id, e.exerciseKey, e.name, e.position, body.data.setIndex, body.data.weightG, body.data.reps, now)
    .run();
  const row = await db
    .prepare("SELECT * FROM workout_sets WHERE session_id = ? AND exercise_key = ? AND set_index = ?")
    .bind(session.id, e.exerciseKey, body.data.setIndex)
    .first<SetRow>();
  const set = rowToSet(row!);
  const after = await loadHistory(db);
  const sessionXp = sessionStats(after, session.id).xp;
  const result: SetResult = { set, xp: sessionXp - xpBefore, pr: setIsPr(after, set), sessionXp };
  return c.json(result, 201);
});

workoutRoutes.patch("/api/workout/sessions/:id/sets/:sid", async (c) => {
  const body = await readBody(c, WorkoutSetPatch);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const sessionId = c.req.param("id");
  const set = await getSet(db, sessionId, c.req.param("sid"));
  if (!set) return notFound(c, SET);
  const xpBefore = sessionStats(await loadHistory(db), sessionId).xp;
  const next: WorkoutSet = { ...set, weightG: body.data.weightG ?? set.weightG, reps: body.data.reps ?? set.reps };
  await db.prepare("UPDATE workout_sets SET weight_g = ?, reps = ? WHERE id = ?").bind(next.weightG, next.reps, set.id).run();
  const after = await loadHistory(db);
  const sessionXp = sessionStats(after, sessionId).xp;
  const result: SetResult = { set: next, xp: sessionXp - xpBefore, pr: setIsPr(after, next), sessionXp };
  return c.json(result);
});

workoutRoutes.delete("/api/workout/sessions/:id/sets/:sid", async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param("id");
  const sid = c.req.param("sid");
  const res = await db.prepare("DELETE FROM workout_sets WHERE id = ? AND session_id = ?").bind(sid, sessionId).run();
  if (!res.meta.changes) return notFound(c, SET);
  return c.json({ id: sid, sessionXp: sessionStats(await loadHistory(db), sessionId).xp });
});

workoutRoutes.post("/api/workout/sessions/:id/finish", async (c) => {
  const db = c.env.DB;
  const session = await getSession(db, c.req.param("id"));
  if (!session) return notFound(c, SESSION);
  if (session.finishedAt) return finishedConflict(c);
  const h = await loadHistory(db);
  const mine = h.sets.filter((s) => s.sessionId === session.id);
  if (!mine.some((s) => s.reps >= 1)) return badRequest(c, "Conclua pelo menos uma série antes de finalizar.");
  const finishedAt = new Date().toISOString();
  await db.prepare("UPDATE workout_sessions SET finished_at = ? WHERE id = ?").bind(finishedAt, session.id).run();
  const done = { ...session, finishedAt };
  const history: WorkoutHistory = { sessions: h.sessions.map((s) => (s.id === session.id ? done : s)), sets: h.sets };
  const idx = history.sessions.findIndex((s) => s.id === session.id);
  const last = lastTimeByKey(history.sessions.slice(0, idx), history.sets);
  const previousSets = [...new Set(mine.map((s) => s.exerciseKey))].flatMap((key) =>
    (last.get(key)?.sets ?? []).map((s) => ({ exerciseKey: key, weightG: s.weightG, reps: s.reps })),
  );
  const summary = buildSessionSummary(done, mine, previousSets, sessionStats(history, session.id).prs);
  return c.json({ summary });
});

workoutRoutes.delete("/api/workout/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const [, del] = await db.batch([
    db.prepare("DELETE FROM workout_sets WHERE session_id = ?").bind(id),
    db.prepare("DELETE FROM workout_sessions WHERE id = ?").bind(id),
  ]);
  if (!del.meta.changes) return notFound(c, SESSION);
  return c.json({ id });
});

// ---------------------------------------------------------------------------
// Relatório semanal e conquistas
// ---------------------------------------------------------------------------

workoutRoutes.get("/api/workout/report", async (c) => {
  const param = c.req.query("week");
  const today = serverToday(c);
  if (param !== undefined && !isRealDate(param)) {
    return badRequest(c, "Informe week=AAAA-MM-DD.", { week: "Data inválida (use AAAA-MM-DD)." });
  }
  const week = weekStart(param ?? today);
  const db = c.env.DB;
  const [history, settings, plan] = await Promise.all([loadHistory(db), getSettings(db), getPlan(db)]);
  const finished = history.sessions.filter((s) => s.finishedAt);
  const finishedById = new Map(finished.map((s) => [s.id, s]));
  const rows = history.sets.flatMap((s) => {
    const sess = finishedById.get(s.sessionId);
    return sess
      ? [{ date: sess.date, exerciseKey: s.exerciseKey, exerciseName: s.exerciseName, weightG: s.weightG, reps: s.reps }]
      : [];
  });

  const xps = workoutXpBySession(history);
  const totalPrs = [...xps.values()].reduce((n, x) => n + x.prs.size, 0);
  const byWeek = doneByWeek(history.sessions);
  const best = bestStreak(byWeek, settings.weeklyGoal);
  const dayVolume = new Map<string, number>();
  for (const r of rows) dayVolume.set(r.date, (dayVolume.get(r.date) ?? 0) + r.weightG * r.reps);
  const doneDates = new Set(finished.map((s) => s.date));
  const planned = plan.filter((d) => d.templateId).map((d) => d.weekday);
  const weeks = [...new Set(finished.map((s) => weekStart(s.date)))].sort().reverse();
  const month = today.slice(0, 7);

  const response: WorkoutReportResponse = {
    report: buildWeekReport(rows, week),
    achievements: achievements({
      bestStreak: best,
      totalPrs,
      maxDayVolumeG: Math.max(0, ...dayVolume.values()),
      perfectWeek: weeks.some((w) => isPerfectWeek(planned, doneDates, w)),
      earlyStart: finished.some((s) => startedEarly(s.startedAt)),
    }),
    weeks: weeks.slice(0, 12),
    stats: {
      streak: streakWeeks(byWeek, settings.weeklyGoal, weekStart(today)),
      bestStreak: best,
      totalPrs,
      monthVolumeG: [...dayVolume].reduce((n, [d, v]) => (d.startsWith(month) ? n + v : n), 0),
    },
  };
  return c.json(response);
});
