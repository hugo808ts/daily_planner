import { Hono } from "hono";
import { z } from "zod";
import { weekDays, weekStart } from "../../shared/dates";
import { DAY_NOTE_MAX, TASK_TITLE_MAX, TASK_TITLE_MIN } from "../../shared/limits";
import { taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { getTask, insertTask, notesBetween, tasksBetween, updateTask } from "../db";
import { badRequest, readBody, type Ctx } from "../http";
import type { Env } from "../index";

const NOT_FOUND = "Tarefa não encontrada.";

const isRealDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const dateSchema = z.string({ error: "Data inválida." }).refine(isRealDate, "Data inválida (use AAAA-MM-DD).");
const timeSchema = z
  .string({ error: "Horário inválido." })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM).");
const areaSchema = z.enum(["work", "school", "personal"], { error: "Área inválida." });
const titleSchema = z
  .string({ error: "Título inválido." })
  .trim()
  .min(TASK_TITLE_MIN, "Informe um título.")
  .max(TASK_TITLE_MAX, `O título deve ter no máximo ${TASK_TITLE_MAX} caracteres.`);

const createSchema = z.object({
  title: titleSchema,
  date: dateSchema,
  time: timeSchema.nullish(),
  area: areaSchema.nullish(),
});
const patchSchema = z.object({
  title: titleSchema.optional(),
  date: dateSchema.optional(),
  time: timeSchema.nullable().optional(),
  area: areaSchema.nullable().optional(),
  done: z.boolean({ error: "Valor inválido." }).optional(),
});
const moveSchema = z.object({ date: dateSchema });
const noteSchema = z.object({
  text: z
    .string({ error: "Texto inválido." })
    .max(DAY_NOTE_MAX, `A anotação deve ter no máximo ${DAY_NOTE_MAX} caracteres.`),
});

const notFound = (c: Ctx) => c.json({ error: NOT_FOUND }, 404);

export const taskRoutes = new Hono<{ Bindings: Env }>();

taskRoutes.get("/api/week", async (c) => {
  const startParam = c.req.query("start");
  if (!startParam || !isRealDate(startParam)) {
    return badRequest(c, "Informe start=AAAA-MM-DD.", { start: "Data inválida (use AAAA-MM-DD)." });
  }
  const start = weekStart(startParam);
  const days = weekDays(start);
  const [tasks, notes] = await Promise.all([
    tasksBetween(c.env.DB, days[0], days[6]),
    notesBetween(c.env.DB, days[0], days[6]),
  ]);
  return c.json({ start, days, tasks, notes });
});

taskRoutes.post("/api/tasks", async (c) => {
  const body = await readBody(c, createSchema);
  if (!body.ok) return body.res;
  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    title: body.data.title,
    date: body.data.date,
    time: body.data.time ?? null,
    area: body.data.area ?? null,
    doneAt: null,
    movedFromId: null,
    createdAt: now,
    updatedAt: now,
  };
  await insertTask(c.env.DB, task);
  return c.json({ task }, 201);
});

taskRoutes.patch("/api/tasks/:id", async (c) => {
  const body = await readBody(c, patchSchema);
  if (!body.ok) return body.res;
  const task = await getTask(c.env.DB, c.req.param("id"));
  if (!task) return notFound(c);
  const p = body.data;
  const now = new Date().toISOString();
  const next: Task = {
    ...task,
    title: p.title ?? task.title,
    date: p.date ?? task.date,
    time: p.time === undefined ? task.time : p.time,
    area: p.area === undefined ? task.area : p.area,
    doneAt: p.done === undefined ? task.doneAt : p.done ? now : null,
    updatedAt: now,
  };
  await updateTask(c.env.DB, next);
  return c.json({ task: next });
});

taskRoutes.delete("/api/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const res = await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
  if (!res.meta.changes) return notFound(c);
  return c.json({ id });
});

taskRoutes.post("/api/tasks/:id/move", async (c) => {
  const body = await readBody(c, moveSchema);
  if (!body.ok) return body.res;
  const task = await getTask(c.env.DB, c.req.param("id"));
  if (!task) return notFound(c);
  if (task.doneAt) return c.json({ error: "Tarefa já concluída." }, 409);
  const now = new Date().toISOString();
  if (taskStatus(task) === "not_done") {
    const copy: Task = {
      ...task,
      id: crypto.randomUUID(),
      date: body.data.date,
      movedFromId: task.id,
      createdAt: now,
      updatedAt: now,
    };
    await insertTask(c.env.DB, copy);
    return c.json({ task: copy, copied: true });
  }
  const moved: Task = { ...task, date: body.data.date, updatedAt: now };
  await updateTask(c.env.DB, moved);
  return c.json({ task: moved, copied: false });
});

taskRoutes.put("/api/day-notes/:date", async (c) => {
  const date = c.req.param("date");
  if (!isRealDate(date)) return badRequest(c, "Data inválida.", { date: "Data inválida (use AAAA-MM-DD)." });
  const body = await readBody(c, noteSchema);
  if (!body.ok) return body.res;
  const text = body.data.text.trim();
  if (!text) {
    await c.env.DB.prepare("DELETE FROM day_notes WHERE date = ?").bind(date).run();
    return c.json({ note: null });
  }
  await c.env.DB.prepare(
    "INSERT INTO day_notes (date, text) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET text = excluded.text",
  )
    .bind(date, text)
    .run();
  return c.json({ note: { date, text } });
});
