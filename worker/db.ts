import type { DayNote, Task } from "../shared/types";

export type TaskRow = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  area: string | null;
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
      "INSERT INTO tasks (id, title, date, time, area, done_at, moved_from_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(t.id, t.title, t.date, t.time, t.area, t.doneAt, t.movedFromId, t.createdAt, t.updatedAt)
    .run();
}

export async function updateTask(db: D1Database, t: Task): Promise<void> {
  await db
    .prepare("UPDATE tasks SET title = ?, date = ?, time = ?, area = ?, done_at = ?, updated_at = ? WHERE id = ?")
    .bind(t.title, t.date, t.time, t.area, t.doneAt, t.updatedAt, t.id)
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
