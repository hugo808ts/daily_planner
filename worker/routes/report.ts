import { Hono } from "hono";
import { addDays, weekStart } from "../../shared/dates";
import { computeWeekReport } from "../../shared/report";
import { tasksBetween } from "../db";
import { badRequest } from "../http";
import type { Env } from "../index";

export const reportRoutes = new Hono<{ Bindings: Env }>();

reportRoutes.get("/api/report", async (c) => {
  const param = c.req.query("start");
  const valid =
    !!param && /^\d{4}-\d{2}-\d{2}$/.test(param) && new Date(`${param}T12:00:00Z`).toISOString().slice(0, 10) === param;
  if (!valid) return badRequest(c, "Informe start=AAAA-MM-DD.", { start: "Data inválida (use AAAA-MM-DD)." });
  const start = weekStart(param);
  const tasks = await tasksBetween(c.env.DB, start, addDays(start, 5));
  return c.json({ report: computeWeekReport(tasks, start) });
});
