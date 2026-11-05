import { addDays } from "./dates";
import { taskStatus } from "./status";
import type { ReportTask, Task, WeekReport } from "./types";
import { medalFor, taskXp, type Difficulty } from "./xp";

/** Resumo de segunda a sábado. Domingo e tarefas ainda pendentes não entram na conta. */
export function computeWeekReport(
  tasks: Task[],
  start: string,
  now: Date = new Date(),
  copied: ReadonlySet<string> = new Set(),
): WeekReport {
  const dates = Array.from({ length: 6 }, (_, i) => addDays(start, i));
  const perDay = dates.map((date) => ({ date, done: 0, notDone: 0 }));
  const notDoneTasks: ReportTask[] = [];
  const xpPerDay = new Map<string, number>(dates.map((d) => [d, 0]));
  const byDifficulty: Record<Difficulty, number> = { low: 0, medium: 0, high: 0 };
  let done = 0;
  let notDone = 0;
  let xp = 0;
  for (const t of tasks) {
    const day = perDay.find((d) => d.date === t.date);
    if (!day) continue;
    const st = taskStatus(t, now);
    if (st === "done") {
      done++;
      day.done++;
      const gained = taskXp(t);
      xp += gained;
      xpPerDay.set(t.date, (xpPerDay.get(t.date) ?? 0) + gained);
      if (t.difficulty in byDifficulty) byDifficulty[t.difficulty]++;
    } else if (st === "not_done") {
      notDone++;
      day.notDone++;
      notDoneTasks.push(copied.has(t.id) ? { ...t, movedTo: true } : t);
    }
  }
  notDoneTasks.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const total = done + notDone;
  let bestDay: string | null = null;
  let bestXp = 0;
  for (const d of dates) {
    const v = xpPerDay.get(d) ?? 0;
    if (v > bestXp) [bestDay, bestXp] = [d, v];
  }
  return {
    start,
    end: dates[5],
    done,
    notDone,
    percent: total ? Math.round((done / total) * 100) : null,
    perDay,
    notDoneTasks,
    xp,
    medal: medalFor(xp),
    byDifficulty,
    bestDay,
  };
}
