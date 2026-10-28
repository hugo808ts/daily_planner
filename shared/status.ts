import { nowParts } from "./dates";
import type { Task } from "./types";

export type TaskStatus = "pending" | "done" | "overdue" | "not_done";

export function taskStatus(task: Task, now: Date = new Date()): TaskStatus {
  if (task.doneAt) return "done";
  const { date, time } = nowParts(now);
  if (task.date > date) return "pending";
  if (task.date < date) return "not_done";
  return task.time !== null && time > task.time ? "overdue" : "pending";
}

export function dayScore(
  tasks: Task[],
  now: Date = new Date(),
): { done: number; overdue: number; notDone: number; pending: number; total: number } {
  const s = { done: 0, overdue: 0, notDone: 0, pending: 0, total: tasks.length };
  for (const t of tasks) {
    const st = taskStatus(t, now);
    if (st === "done") s.done++;
    else if (st === "overdue") s.overdue++;
    else if (st === "not_done") s.notDone++;
    else s.pending++;
  }
  return s;
}
