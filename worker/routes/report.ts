import { Hono } from "hono";
import { addDays, isRealDate, weekStart } from "../../shared/dates";
import { computeWeekReport } from "../../shared/report";
import { levelFromXp, medalFor, nextMedal } from "../../shared/xp";
import { tasksBetween } from "../db";
import { badRequest } from "../http";
import type { Env } from "../index";
import { totalXp, xpByWeek } from "../xp";

export const reportRoutes = new Hono<{ Bindings: Env }>();

const invalidStart = { start: "Data inválida (use AAAA-MM-DD)." };

reportRoutes.get("/api/report", async (c) => {
  const param = c.req.query("start");
  if (!isRealDate(param)) return badRequest(c, "Informe start=AAAA-MM-DD.", invalidStart);
  const start = weekStart(param);
  const end = addDays(start, 5);
  const [tasks, copiedRows, weeks] = await Promise.all([
    tasksBetween(c.env.DB, start, end),
    // Tarefas que já têm uma cópia em outro dia (levar não pode duplicar).
    c.env.DB.prepare(
      "SELECT t.id FROM tasks t WHERE t.date BETWEEN ? AND ? AND EXISTS(SELECT 1 FROM tasks c WHERE c.moved_from_id = t.id)",
    )
      .bind(start, end)
      .all<{ id: string }>(),
    xpByWeek(c.env.DB),
  ]);
  const report = computeWeekReport(tasks, start, new Date(), new Set(copiedRows.results.map((r) => r.id)));
  let bestWeekXp = 0;
  for (const w of weeks.values()) if (w.week <= start && w.xp > bestWeekXp) bestWeekXp = w.xp;
  return c.json({
    report,
    /** XP (seg–sáb) da semana anterior. */
    previousXp: weeks.get(addDays(start, -7))?.xp ?? 0,
    /** Maior XP (seg–sáb) de uma semana do histórico até esta, inclusive. */
    bestWeekXp,
    /** Nível com o XP total até o fim desta semana (domingo incluído). */
    level: levelFromXp(totalXp(weeks, (w) => w <= start)),
    /** Nível antes desta semana. */
    levelBefore: levelFromXp(totalXp(weeks, (w) => w < start)).level,
  });
});

reportRoutes.get("/api/progress", async (c) => {
  const param = c.req.query("start");
  if (!isRealDate(param)) return badRequest(c, "Informe start=AAAA-MM-DD.", invalidStart);
  const start = weekStart(param);
  const weeks = await xpByWeek(c.env.DB);
  const total = totalXp(weeks);
  const weekXp = weeks.get(start)?.xp ?? 0;
  return c.json({ totalXp: total, ...levelFromXp(total), weekXp, medal: medalFor(weekXp), next: nextMedal(weekXp) });
});
