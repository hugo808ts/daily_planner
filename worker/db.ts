import type { DayNote, Task, TodoView } from "../shared/types";
import { XP_DONE_AT_FROM } from "../shared/xp";

/** Dia local (America/Sao_Paulo, -3 h fixo, sem horário de verão; o mesmo de shared/dates.ts) de done_at. */
export const DONE_DAY_SQL = "date(done_at, '-3 hours')";

export type TaskRow = {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  area: string | null;
  difficulty: string;
  done_at: string | null;
  moved_from_id: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    time: r.time,
    area: r.area as Task["area"],
    difficulty: r.difficulty as Task["difficulty"],
    doneAt: r.done_at,
    movedFromId: r.moved_from_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getTask(db: D1Database, id: string): Promise<Task | null> {
  const row = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<TaskRow>();
  return row ? rowToTask(row) : null;
}

export async function insertTask(db: D1Database, t: Task): Promise<void> {
  await db
    .prepare(
      "INSERT INTO tasks (id, title, date, time, area, difficulty, done_at, moved_from_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(t.id, t.title, t.date, t.time, t.area, t.difficulty, t.doneAt, t.movedFromId, t.createdAt, t.updatedAt)
    .run();
}

export async function updateTask(db: D1Database, t: Task): Promise<void> {
  await db
    .prepare(
      "UPDATE tasks SET title = ?, date = ?, time = ?, area = ?, difficulty = ?, done_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(t.title, t.date, t.time, t.area, t.difficulty, t.doneAt, t.updatedAt, t.id)
    .run();
}

export async function tasksBetween(db: D1Database, from: string, to: string): Promise<Task[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM tasks WHERE date BETWEEN ? AND ? ORDER BY date, time IS NULL, time, created_at, rowid",
    )
    .bind(from, to)
    .all<TaskRow>();
  return results.map(rowToTask);
}

export async function notesBetween(db: D1Database, from: string, to: string): Promise<DayNote[]> {
  const { results } = await db
    .prepare("SELECT date, text FROM day_notes WHERE date BETWEEN ? AND ? ORDER BY date")
    .bind(from, to)
    .all<DayNote>();
  return results;
}

/** Lista "A fazer" de `date`: sem data e não feitas (mais antigas primeiro), sem data feitas nesse dia, e compromissos do dia. */
/** SQL do dia em que a tarefa feita conta XP (mesma regra de taskXpDay em shared/xp.ts). */
export const XP_DAY_SQL = `CASE WHEN date IS NULL OR ${DONE_DAY_SQL} >= '${XP_DONE_AT_FROM}' THEN ${DONE_DAY_SQL} ELSE date END`;

/** Tarefas do resumo: com dia na semana, mais as feitas que contam XP nela (dia local de done_at). */
export async function tasksForReport(db: D1Database, from: string, to: string): Promise<Task[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM tasks WHERE date BETWEEN ?1 AND ?2 OR (done_at IS NOT NULL AND ${XP_DAY_SQL} BETWEEN ?1 AND ?2)
       ORDER BY date IS NULL, date, time IS NULL, time, created_at, rowid`,
    )
    .bind(from, to)
    .all<TaskRow>();
  return results.map(rowToTask);
}

export async function todoOf(db: D1Database, date: string): Promise<TodoView> {
  const [undated, appointments] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM tasks WHERE date IS NULL AND (done_at IS NULL OR ${DONE_DAY_SQL} = ?)
         ORDER BY done_at IS NOT NULL, done_at, created_at, rowid`,
      )
      .bind(date)
      .all<TaskRow>(),
    db
      // Compromissos do dia + os de dias passados ainda não feitos (ficam atrasados até marcar).
      .prepare(
        `SELECT * FROM tasks WHERE date = ? OR (date < ? AND done_at IS NULL)
         ORDER BY date, time IS NULL, time, created_at, rowid`,
      )
      .bind(date, date)
      .all<TaskRow>(),
  ]);
  return { date, undated: undated.results.map(rowToTask), appointments: appointments.results.map(rowToTask) };
}
