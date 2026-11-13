import { weekStart } from "../shared/dates";
import { recordsBySession, sessionXp } from "../shared/workout";
import { XP_BY_DIFFICULTY, type Difficulty } from "../shared/xp";
import { loadHistory, type WorkoutHistory } from "./workout-db";

/**
 * XP de uma semana (chave = segunda-feira): `xp` = tarefas seg–sáb (medalha); `sundayXp` (tarefas de domingo)
 * e `workoutXp` (treino) só contam para o nível.
 */
export type WeekXp = { week: string; xp: number; sundayXp: number; workoutXp: number };

/** XP e recordes de cada sessão de treino, sempre calculados a partir das séries. */
export function workoutXpBySession(h: WorkoutHistory): Map<string, { xp: number; prs: Set<string> }> {
  const prs = recordsBySession(h.sessions, h.sets);
  const bySession = new Map<string, { reps: number }[]>();
  for (const s of h.sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const out = new Map<string, { xp: number; prs: Set<string> }>();
  for (const s of h.sessions) {
    const p = prs.get(s.id) ?? new Set<string>();
    out.set(s.id, { xp: sessionXp({ sets: bySession.get(s.id) ?? [], finished: !!s.finishedAt }, p.size), prs: p });
  }
  return out;
}

/**
 * XP de todo o histórico por semana, sempre calculado (não há coluna de XP): uma consulta agrupa as
 * tarefas feitas por semana, domingo e dificuldade, e os valores vêm de XP_BY_DIFFICULTY.
 * O XP vale para o dia (`date`) da tarefa ou da sessão de treino.
 */
export async function xpByWeek(db: D1Database): Promise<Map<string, WeekXp>> {
  const [{ results }, history] = await Promise.all([
    db
      .prepare(
        `SELECT date(date, '-6 days', 'weekday 1') AS week, strftime('%w', date) = '0' AS sunday, difficulty, COUNT(*) AS n
         FROM tasks WHERE done_at IS NOT NULL GROUP BY week, sunday, difficulty`,
      )
      .all<{ week: string; sunday: number; difficulty: string; n: number }>(),
    loadHistory(db),
  ]);
  const weeks = new Map<string, WeekXp>();
  const at = (week: string) => {
    const w = weeks.get(week) ?? { week, xp: 0, sundayXp: 0, workoutXp: 0 };
    weeks.set(week, w);
    return w;
  };
  for (const r of results) {
    const w = at(r.week);
    const gained = (XP_BY_DIFFICULTY[r.difficulty as Difficulty] ?? 0) * r.n;
    if (r.sunday) w.sundayXp += gained;
    else w.xp += gained;
  }
  const xps = workoutXpBySession(history);
  for (const s of history.sessions) at(weekStart(s.date)).workoutXp += xps.get(s.id)?.xp ?? 0;
  return weeks;
}

/** Soma do XP (domingo e treino incluídos) das semanas que passam no filtro. */
export function totalXp(weeks: Map<string, WeekXp>, keep: (week: string) => boolean = () => true): number {
  let total = 0;
  for (const w of weeks.values()) if (keep(w.week)) total += w.xp + w.sundayXp + w.workoutXp;
  return total;
}
