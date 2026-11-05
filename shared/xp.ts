import type { Task } from "./types";

/** Dificuldade da tarefa; define quanto XP ela vale quando feita. */
export type Difficulty = "low" | "medium" | "high";

export const DIFFICULTIES = ["low", "medium", "high"] as const satisfies readonly Difficulty[];

export const XP_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = { low: 10, medium: 25, high: 50 };

/** XP de uma tarefa: o da dificuldade se feita, 0 se não. */
export function taskXp(task: Pick<Task, "difficulty" | "doneAt">): number {
  return task.doneAt ? (XP_BY_DIFFICULTY[task.difficulty] ?? 0) : 0;
}

export type MedalTier = "bronze" | "prata" | "ouro" | "diamante" | "supremo";

/** Medalhas da semana (seg–sáb), da menor para a maior; `min` = XP mínimo. */
export const MEDALS: readonly { tier: MedalTier; label: string; min: number }[] = [
  { tier: "bronze", label: "Bronze", min: 1 },
  { tier: "prata", label: "Prata", min: 150 },
  { tier: "ouro", label: "Ouro", min: 300 },
  { tier: "diamante", label: "Diamante", min: 500 },
  { tier: "supremo", label: "Supremo", min: 750 },
];

/** Medalha para o XP da semana; null com 0 XP. */
export function medalFor(xp: number): MedalTier | null {
  let tier: MedalTier | null = null;
  for (const m of MEDALS) if (xp >= m.min) tier = m.tier;
  return tier;
}

/** Próxima medalha e quanto XP falta; null quando já é Supremo. */
export function nextMedal(xp: number): { medal: MedalTier; missing: number } | null {
  const m = MEDALS.find((x) => x.min > xp);
  return m ? { medal: m.tier, missing: m.min - xp } : null;
}

/** XP para passar do nível `level` ao seguinte. */
export function xpToNext(level: number): number {
  return Math.round(300 * 1.2 ** (level - 1));
}

/** Nível (começa em 1) a partir do XP total, com o XP já feito no nível e o necessário para o próximo. */
export function levelFromXp(total: number): { level: number; into: number; needed: number } {
  let level = 1;
  let into = Math.max(0, total);
  let needed = xpToNext(level);
  while (into >= needed) {
    into -= needed;
    level++;
    needed = xpToNext(level);
  }
  return { level, into, needed };
}
