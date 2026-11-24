import { addDays } from "./dates";
import { taskStatus } from "./status";
import type { ReportTask, Task, WeekReport } from "./types";
import { medalFor, taskXp, taskXpDay, type Difficulty } from "./xp";

/**
 * Resumo de segunda a sábado. Domingo e tarefas ainda pendentes não entram na conta.
 * Feitas contam no dia de taskXpDay; não feitas, no dia da tarefa.
 */
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
    const st = taskStatus(t, now);
    if (st === "done") {
      // Feita conta no dia do XP (dia local de done_at a partir da data de corte; antes, o dia da tarefa).
      const xpDay = taskXpDay(t);
      const day = perDay.find((d) => d.date === xpDay);
      if (!day || !xpDay) continue;
      done++;
      day.done++;
      const gained = taskXp(t);
      xp += gained;
      xpPerDay.set(xpDay, (xpPerDay.get(xpDay) ?? 0) + gained);
      if (t.difficulty in byDifficulty) byDifficulty[t.difficulty]++;
      continue;
    }
    // Sem data nunca vira "não feita" (taskStatus devolve pendente).
    const day = perDay.find((d) => d.date === t.date);
    if (!day) continue;
    if (st === "not_done") {
      notDone++;
      day.notDone++;
      notDoneTasks.push(copied.has(t.id) ? { ...t, movedTo: true } : t);
    }
  }
  notDoneTasks.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
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
