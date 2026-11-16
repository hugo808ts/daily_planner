import { Hono } from "hono";
import { isRealDate } from "../../shared/dates";
import {
  completeDates,
  daysStreak,
  missionActiveOn,
  MissionCheckPut,
  MissionCreate,
  MissionOrder,
  MissionPatch,
  missionStreak,
  weekWindows,
  type Mission,
  type MissionBase,
  type MissionCheck,
  type MissionCheckResult,
  type MissionDay,
  type MissionsDayView,
} from "../../shared/hero";
import { MISSIONS_ACTIVE_MAX } from "../../shared/limits";
import { getMission, loadChecks, loadMissions } from "../hero-db";
import { badRequest, readBody, serverToday, type Ctx } from "../http";
import type { Env } from "../index";

const NOT_FOUND = "Missão não encontrada.";
const LOCKED = "Arquive e crie outra para mudar o XP.";
const invalidDate = { date: "Data inválida (use AAAA-MM-DD)." };

const notFound = (c: Ctx) => c.json({ error: NOT_FOUND }, 404);

/** Missão com `hasChecks`, `streak` e `done` vistos no dia `date`. */
function missionOn(m: MissionBase, checks: MissionCheck[], date: string): MissionDay {
  const dates = checks.filter((c) => c.missionId === m.id).map((c) => c.date);
  return { ...m, hasChecks: dates.length > 0, streak: missionStreak(dates, date), done: dates.includes(date) };
}

const plain = ({ done: _done, ...m }: MissionDay): Mission => m;

async function dayView(db: D1Database, date: string, today: string): Promise<MissionsDayView> {
  const [missions, checks] = await Promise.all([loadMissions(db), loadChecks(db)]);
  const complete = completeDates(missions, checks);
  return {
    date,
    today,
    missions: missions.filter((m) => missionActiveOn(m, date)).map((m) => missionOn(m, checks, date)),
    complete: complete.has(date),
    dayStreak: daysStreak(complete, date),
    week: weekWindows(date, today, complete),
  };
}

export const missionRoutes = new Hono<{ Bindings: Env }>();

missionRoutes.get("/api/missions", async (c) => {
  const today = serverToday(c);
  const date = c.req.query("date") ?? today;
  if (!isRealDate(date)) return badRequest(c, "Informe date=AAAA-MM-DD.", invalidDate);
  return c.json(await dayView(c.env.DB, date, today));
});

missionRoutes.post("/api/missions", async (c) => {
  const body = await readBody(c, MissionCreate);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const active = await db
    .prepare("SELECT COUNT(*) AS n, MAX(position) AS p FROM missions WHERE archived_date IS NULL")
    .first<{ n: number; p: number | null }>();
  if ((active?.n ?? 0) >= MISSIONS_ACTIVE_MAX) {
    return c.json({ error: `No máximo ${MISSIONS_ACTIVE_MAX} missões ativas. Arquive uma para criar outra.` }, 409);
  }
  const now = new Date().toISOString();
  const m: MissionBase = {
    id: crypto.randomUUID(),
    title: body.data.title,
    attribute: body.data.attribute,
    xp: body.data.xp,
    position: (active?.p ?? -1) + 1,
    startDate: serverToday(c),
    archivedDate: null,
    createdAt: now,
    updatedAt: now,
  };
  await db
    .prepare(
      "INSERT INTO missions (id, title, attribute, xp, position, start_date, archived_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)",
    )
    .bind(m.id, m.title, m.attribute, m.xp, m.position, m.startDate, m.createdAt, m.updatedAt)
    .run();
  const mission: Mission = { ...m, hasChecks: false, streak: 0 };
  return c.json({ mission }, 201);
});

// Registrada antes de /:id para "order" não virar um id.
missionRoutes.patch("/api/missions/order", async (c) => {
  const body = await readBody(c, MissionOrder);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const { results } = await db.prepare("SELECT id FROM missions WHERE archived_date IS NULL").all<{ id: string }>();
  const current = new Set(results.map((r) => r.id));
  const ids = body.data.ids;
  if (ids.length !== current.size || new Set(ids).size !== ids.length || !ids.every((i) => current.has(i))) {
    return badRequest(c, "Envie todas as missões ativas, sem repetir.", { ids: "Lista de missões inválida." });
  }
  const now = new Date().toISOString();
  if (ids.length) {
    await db.batch(
      ids.map((id, i) => db.prepare("UPDATE missions SET position = ?, updated_at = ? WHERE id = ?").bind(i, now, id)),
    );
  }
  const today = serverToday(c);
  return c.json(await dayView(db, today, today));
});

missionRoutes.patch("/api/missions/:id", async (c) => {
  const body = await readBody(c, MissionPatch);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const m = await getMission(db, c.req.param("id"));
  if (!m) return notFound(c);
  const p = body.data;
  const changesXp = p.xp !== undefined && p.xp !== m.xp;
  const changesAttr = p.attribute !== undefined && p.attribute !== m.attribute;
  if (changesXp || changesAttr) {
    const used = await db.prepare("SELECT 1 AS x FROM mission_checks WHERE mission_id = ? LIMIT 1").bind(m.id).first();
    if (used) {
      const fields: Record<string, string> = {};
      if (changesXp) fields.xp = LOCKED;
      if (changesAttr) fields.attribute = LOCKED;
      return c.json({ error: LOCKED, fields }, 409);
    }
  }
  const next: MissionBase = {
    ...m,
    title: p.title ?? m.title,
    xp: p.xp ?? m.xp,
    attribute: p.attribute ?? m.attribute,
    updatedAt: new Date().toISOString(),
  };
  await db
    .prepare("UPDATE missions SET title = ?, xp = ?, attribute = ?, updated_at = ? WHERE id = ?")
    .bind(next.title, next.xp, next.attribute, next.updatedAt, next.id)
    .run();
  return c.json({ mission: plain(missionOn(next, await loadChecks(db), serverToday(c))) });
});

/** Arquiva (nunca apaga com histórico). Sem marcações e criada hoje: apaga de verdade. */
missionRoutes.delete("/api/missions/:id", async (c) => {
  const db = c.env.DB;
  const m = await getMission(db, c.req.param("id"));
  if (!m || m.archivedDate) return notFound(c);
  const today = serverToday(c);
  const used = await db.prepare("SELECT 1 AS x FROM mission_checks WHERE mission_id = ? LIMIT 1").bind(m.id).first();
  if (!used && m.startDate >= today) {
    await db.prepare("DELETE FROM missions WHERE id = ?").bind(m.id).run();
    return c.json({ id: m.id, deleted: true });
  }
  await db
    .prepare("UPDATE missions SET archived_date = ?, updated_at = ? WHERE id = ?")
    .bind(today, new Date().toISOString(), m.id)
    .run();
  return c.json({ id: m.id, deleted: false });
});

missionRoutes.put("/api/missions/:id/checks/:date", async (c) => {
  const date = c.req.param("date");
  if (!isRealDate(date)) return badRequest(c, "Data inválida.", invalidDate);
  const today = serverToday(c);
  if (date > today) return badRequest(c, "Não dá para marcar um dia futuro.", { date: "Escolha hoje ou um dia passado." });
  const body = await readBody(c, MissionCheckPut);
  if (!body.ok) return body.res;
  const db = c.env.DB;
  const m = await getMission(db, c.req.param("id"));
  if (!m) return notFound(c);
  if (!missionActiveOn(m, date)) return badRequest(c, "Essa missão não vale nesse dia.", { date: "A missão não vale nesse dia." });
  if (body.data.done) {
    await db
      .prepare("INSERT OR IGNORE INTO mission_checks (mission_id, date, done_at) VALUES (?, ?, ?)")
      .bind(m.id, date, new Date().toISOString())
      .run();
  } else {
    await db.prepare("DELETE FROM mission_checks WHERE mission_id = ? AND date = ?").bind(m.id, date).run();
  }
  const [missions, checks] = await Promise.all([loadMissions(db), loadChecks(db)]);
  const xpOf = new Map(missions.map((x) => [x.id, x.xp]));
  const complete = completeDates(missions, checks);
  const result: MissionCheckResult = {
    mission: missionOn(m, checks, date),
    xp: checks.filter((x) => x.date === date).reduce((s, x) => s + (xpOf.get(x.missionId) ?? 0), 0),
    complete: complete.has(date),
    dayStreak: daysStreak(complete, date),
  };
  return c.json(result);
});
