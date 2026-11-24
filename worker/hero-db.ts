import { XP_DAY_SQL } from "./db";
import type { AttributeId, MissionBase, MissionCheck } from "../shared/hero";

// Linhas do D1 (snake_case) e mappers para o JSON (camelCase).

export type MissionRow = {
  id: string;
  title: string;
  attribute: AttributeId;
  xp: number;
  position: number;
  start_date: string;
  archived_date: string | null;
  created_at: string;
  updated_at: string;
};

export const rowToMission = (r: MissionRow): MissionBase => ({
  id: r.id,
  title: r.title,
  attribute: r.attribute,
  xp: r.xp,
  position: r.position,
  startDate: r.start_date,
  archivedDate: r.archived_date,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Todas as missões (ativas e arquivadas), na ordem da tela. */
export async function loadMissions(db: D1Database): Promise<MissionBase[]> {
  const { results } = await db.prepare("SELECT * FROM missions ORDER BY position, created_at, rowid").all<MissionRow>();
  return results.map(rowToMission);
}

export async function getMission(db: D1Database, id: string): Promise<MissionBase | null> {
  const r = await db.prepare("SELECT * FROM missions WHERE id = ?").bind(id).first<MissionRow>();
  return r ? rowToMission(r) : null;
}

/** Todas as marcações (usuário único: cabe na memória), em ordem de data. */
export async function loadChecks(db: D1Database): Promise<MissionCheck[]> {
  const { results } = await db
    .prepare("SELECT mission_id, date FROM mission_checks ORDER BY date, mission_id")
    .all<{ mission_id: string; date: string }>();
  return results.map((r) => ({ missionId: r.mission_id, date: r.date }));
}

/** Dias com movimentação registrada pelo Agente Finanças, em ordem. */
export async function loadFinanceDays(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare("SELECT date FROM finance_days ORDER BY date").all<{ date: string }>();
  return results.map((r) => r.date);
}

/** Tarefas feitas agrupadas por dia, área e dificuldade (uma consulta). */
export async function taskFacts(
  db: D1Database,
): Promise<{ date: string; area: string | null; difficulty: string; n: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT day AS date, area, difficulty, COUNT(*) AS n FROM (SELECT ${XP_DAY_SQL} AS day, area, difficulty FROM tasks WHERE done_at IS NOT NULL) GROUP BY day, area, difficulty ORDER BY day`,
    )
    .all<{ date: string; area: string | null; difficulty: string; n: number }>();
  return results;
}
