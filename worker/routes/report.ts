import { Hono } from "hono";
import { addDays, isRealDate, weekStart } from "../../shared/dates";
import { computeWeekReport } from "../../shared/report";
import { tasksBetween } from "../db";
import { badRequest } from "../http";
import type { Env } from "../index";

export const reportRoutes = new Hono<{ Bindings: Env }>();

reportRoutes.get("/api/report", async (c) => {
  const param = c.req.query("start");
  if (!isRealDate(param)) return badRequest(c, "Informe start=AAAA-MM-DD.", { start: "Data inválida (use AAAA-MM-DD)." });
  const start = weekStart(param);
  const end = addDays(start, 5);
  const tasks = await tasksBetween(c.env.DB, start, end);
  // Tarefas que já têm uma cópia em outro dia (levar não pode duplicar).
  const { results } = await c.env.DB.prepare(
    "SELECT t.id FROM tasks t WHERE t.date BETWEEN ? AND ? AND EXISTS(SELECT 1 FROM tasks c WHERE c.moved_from_id = t.id)",
  )
    .bind(start, end)
    .all<{ id: string }>();
  return c.json({ report: computeWeekReport(tasks, start, new Date(), new Set(results.map((r) => r.id))) });
});
