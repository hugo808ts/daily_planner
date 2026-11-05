import { XP_BY_DIFFICULTY, type Difficulty } from "../shared/xp";

/** XP de uma semana (chave = segunda-feira): `xp` = seg–sáb (medalha); `sundayXp` só conta para o nível. */
export type WeekXp = { week: string; xp: number; sundayXp: number };

/**
 * XP de todo o histórico por semana, sempre calculado (não há coluna de XP): uma consulta agrupa as
 * tarefas feitas por semana, domingo e dificuldade, e os valores vêm de XP_BY_DIFFICULTY.
 * O XP vale para o dia (`date`) da tarefa.
 */
export async function xpByWeek(db: D1Database): Promise<Map<string, WeekXp>> {
  const { results } = await db
    .prepare(
      `SELECT date(date, '-6 days', 'weekday 1') AS week, strftime('%w', date) = '0' AS sunday, difficulty, COUNT(*) AS n
       FROM tasks WHERE done_at IS NOT NULL GROUP BY week, sunday, difficulty`,
    )
    .all<{ week: string; sunday: number; difficulty: string; n: number }>();
  const weeks = new Map<string, WeekXp>();
  for (const r of results) {
    const w = weeks.get(r.week) ?? { week: r.week, xp: 0, sundayXp: 0 };
    const gained = (XP_BY_DIFFICULTY[r.difficulty as Difficulty] ?? 0) * r.n;
    if (r.sunday) w.sundayXp += gained;
    else w.xp += gained;
    weeks.set(r.week, w);
  }
  return weeks;
}

/** Soma do XP (domingo incluído) das semanas que passam no filtro. */
export function totalXp(weeks: Map<string, WeekXp>, keep: (week: string) => boolean = () => true): number {
  let total = 0;
  for (const w of weeks.values()) if (keep(w.week)) total += w.xp + w.sundayXp;
  return total;
}
