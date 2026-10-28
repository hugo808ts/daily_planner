import { addDays } from "./dates";
import { taskStatus } from "./status";
import type { Task, WeekReport } from "./types";

/** Resumo de segunda a sábado. Domingo e tarefas ainda pendentes não entram na conta. */
export function computeWeekReport(tasks: Task[], start: string, now: Date = new Date()): WeekReport {
  const dates = Array.from({ length: 6 }, (_, i) => addDays(start, i));
  const perDay = dates.map((date) => ({ date, done: 0, notDone: 0 }));
  const notDoneTasks: Task[] = [];
  let done = 0;
  let notDone = 0;
  for (const t of tasks) {
    const day = perDay.find((d) => d.date === t.date);
    if (!day) continue;
    const st = taskStatus(t, now);
    if (st === "done") {
      done++;
      day.done++;
    } else if (st === "not_done") {
      notDone++;
      day.notDone++;
      notDoneTasks.push(t);
    }
  }
  notDoneTasks.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const total = done + notDone;
  return {
    start,
    end: dates[5],
    done,
    notDone,
    percent: total ? Math.round((done / total) * 100) : 0,
    perDay,
    notDoneTasks,
  };
}
