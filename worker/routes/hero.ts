import { Hono } from "hono";
import { addDays, isRealDate, weekStart } from "../../shared/dates";
import {
  allTrails,
  ATTRIBUTES,
  attributeXp,
  buildTower,
  completeDates,
  currentTitle,
  daysStreak,
  gearFrom,
  heroStage,
  sourcesPct,
  STAGE_LABEL,
  unlockedBetween,
  type AttributeId,
  type HeroFacts,
  type HeroTrailView,
  type HeroView,
  type HeroWeekView,
} from "../../shared/hero";
import { doneByWeek, volumeOf } from "../../shared/workout";
import { levelFromXp } from "../../shared/xp";
import { loadChecks, loadFinanceDays, loadMissions, taskFacts } from "../hero-db";
import { badRequest, serverToday } from "../http";
import type { Env } from "../index";
import { getSettings, loadHistory } from "../workout-db";
import { totalXp, workoutXpBySession, xpByWeek } from "../xp";

/** Tudo o que o Herói precisa, carregado com poucas consultas agrupadas (nada por semana). */
async function loadHero(db: D1Database, today: string) {
  const [history, settings, tasks, missions, checks, financeDays] = await Promise.all([
    loadHistory(db),
    getSettings(db),
    taskFacts(db),
    loadMissions(db),
    loadChecks(db),
    loadFinanceDays(db),
  ]);
  const weeks = await xpByWeek(db, history);
  const xps = workoutXpBySession(history);
  const setsBySession = new Map<string, { weightG: number; reps: number }[]>();
  for (const s of history.sets) setsBySession.set(s.sessionId, [...(setsBySession.get(s.sessionId) ?? []), s]);
  const missionById = new Map(missions.map((m) => [m.id, m]));

  const facts: HeroFacts = {
    taskRows: tasks,
    missionChecks: checks.flatMap((c) => {
      const m = missionById.get(c.missionId);
      return m ? [{ date: c.date, attribute: m.attribute, xp: m.xp }] : [];
    }),
    workoutSessions: history.sessions.map((s) => ({
      date: s.date,
      finished: !!s.finishedAt,
      xp: xps.get(s.id)?.xp ?? 0,
      prs: xps.get(s.id)?.prs.size ?? 0,
      volumeG: volumeOf(setsBySession.get(s.id) ?? []),
    })),
    financeDays,
    weeklyGoal: settings.weeklyGoal,
  };

  const complete = completeDates(missions, checks);
  const activity = [
    ...tasks.map((t) => t.date),
    ...checks.map((c) => c.date),
    ...history.sessions.filter((s) => s.finishedAt).map((s) => s.date),
    ...financeDays,
  ].sort();
  const towerInput = {
    weeks: Object.fromEntries([...weeks].map(([w, x]) => [w, x.xp])),
    completeDates: complete,
    trainDoneByWeek: doneByWeek(history.sessions),
    goal: settings.weeklyGoal,
    today,
  };
  const trails = allTrails(facts, today);
  const attributes = attributeXp({
    taskRows: tasks,
    missionRows: facts.missionChecks,
    workoutXp: facts.workoutSessions.reduce((s, x) => s + x.xp, 0),
    financeDays: financeDays.length,
  });
  return { weeks, facts, complete, firstActivity: activity[0] ?? null, towerInput, trails, attributes };
}

export const heroRoutes = new Hono<{ Bindings: Env }>();

heroRoutes.get("/api/hero", async (c) => {
  const today = serverToday(c);
  const h = await loadHero(c.env.DB, today);
  const total = totalXp(h.weeks);
  const lvl = levelFromXp(total);
  const stage = heroStage(lvl.level);
  const view: HeroView = {
    today,
    ...lvl,
    totalXp: total,
    stage,
    stageLabel: STAGE_LABEL[stage],
    title: currentTitle(h.trails) ?? STAGE_LABEL[stage],
    attributes: h.attributes,
    gear: gearFrom(h.trails),
    dayStreak: daysStreak(h.complete, today),
    tower: buildTower({ ...h.towerInput, firstWeek: h.firstActivity }),
  };
  return c.json(view);
});

heroRoutes.get("/api/hero/trail/:attr", async (c) => {
  const attr = c.req.param("attr");
  if (!(ATTRIBUTES as readonly string[]).includes(attr)) return c.json({ error: "Atributo não encontrado." }, 404);
  const id = attr as AttributeId;
  const h = await loadHero(c.env.DB, serverToday(c));
  const a = h.attributes[id];
  const view: HeroTrailView = { attribute: { ...a, sourcesPct: sourcesPct(a.sources) }, nodes: h.trails[id] };
  return c.json(view);
});

heroRoutes.get("/api/hero/week", async (c) => {
  const param = c.req.query("start");
  if (!isRealDate(param)) return badRequest(c, "Informe start=AAAA-MM-DD.", { start: "Data inválida (use AAAA-MM-DD)." });
  const start = weekStart(param);
  const end = addDays(start, 6);
  const h = await loadHero(c.env.DB, serverToday(c));
  const first = h.firstActivity && h.firstActivity < start ? h.firstActivity : start;
  const floor = buildTower({ ...h.towerInput, firstWeek: first }).find((f) => f.week === start) ?? null;
  const view: HeroWeekView = {
    start,
    floor,
    unlocked: unlockedBetween(h.trails, start, end),
    gear: gearFrom(h.trails).filter((g) => g.unlockedOn && g.unlockedOn >= start && g.unlockedOn <= end),
    stageBefore: heroStage(levelFromXp(totalXp(h.weeks, (w) => w < start)).level),
    stageAfter: heroStage(levelFromXp(totalXp(h.weeks, (w) => w <= start)).level),
  };
  return c.json(view);
});
