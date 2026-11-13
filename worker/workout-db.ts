import type {
  HistorySession,
  WorkoutExercise,
  WorkoutPlanDay,
  WorkoutSet,
  WorkoutSettings,
  WorkoutTemplate,
} from "../shared/workout";

// Linhas do D1 (snake_case) e mappers para o JSON (camelCase).

export type TemplateRow = {
  id: string;
  name: string;
  focus: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};
export type ExerciseRow = {
  id: string;
  template_id: string;
  name: string;
  exercise_key: string;
  position: number;
  sets: number;
  reps: number;
  weight_g: number;
  rest_s: number;
  created_at: string;
  updated_at: string;
};
export type SessionRow = {
  id: string;
  date: string;
  template_id: string | null;
  template_name: string;
  started_at: string;
  finished_at: string | null;
};
export type SetRow = {
  id: string;
  session_id: string;
  exercise_key: string;
  exercise_name: string;
  exercise_position: number;
  set_index: number;
  weight_g: number;
  reps: number;
  done_at: string;
};

export const rowToExercise = (r: ExerciseRow): WorkoutExercise => ({
  id: r.id,
  templateId: r.template_id,
  name: r.name,
  exerciseKey: r.exercise_key,
  position: r.position,
  sets: r.sets,
  reps: r.reps,
  weightG: r.weight_g,
  restS: r.rest_s,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToTemplate = (r: TemplateRow, exercises: WorkoutExercise[]): WorkoutTemplate => ({
  id: r.id,
  name: r.name,
  focus: r.focus,
  position: r.position,
  exercises,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type WorkoutSession = HistorySession & { templateId: string | null; templateName: string };

export const rowToSession = (r: SessionRow): WorkoutSession => ({
  id: r.id,
  date: r.date,
  templateId: r.template_id,
  templateName: r.template_name,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
});

export const rowToSet = (r: SetRow): WorkoutSet => ({
  id: r.id,
  sessionId: r.session_id,
  exerciseKey: r.exercise_key,
  exerciseName: r.exercise_name,
  exercisePosition: r.exercise_position,
  setIndex: r.set_index,
  weightG: r.weight_g,
  reps: r.reps,
  doneAt: r.done_at,
});

export async function listTemplates(db: D1Database): Promise<WorkoutTemplate[]> {
  const [t, e] = await db.batch([
    db.prepare("SELECT * FROM workout_templates ORDER BY position, created_at, rowid"),
    db.prepare("SELECT * FROM workout_exercises ORDER BY position, created_at, rowid"),
  ]);
  const exercises = (e.results as ExerciseRow[]).map(rowToExercise);
  return (t.results as TemplateRow[]).map((r) =>
    rowToTemplate(
      r,
      exercises.filter((x) => x.templateId === r.id),
    ),
  );
}

export async function getTemplate(db: D1Database, id: string): Promise<WorkoutTemplate | null> {
  const [t, e] = await db.batch([
    db.prepare("SELECT * FROM workout_templates WHERE id = ?").bind(id),
    db.prepare("SELECT * FROM workout_exercises WHERE template_id = ? ORDER BY position, created_at, rowid").bind(id),
  ]);
  const row = (t.results as TemplateRow[])[0];
  return row ? rowToTemplate(row, (e.results as ExerciseRow[]).map(rowToExercise)) : null;
}

export async function getSettings(db: D1Database): Promise<WorkoutSettings> {
  const r = await db
    .prepare("SELECT weekly_goal, default_rest_s, sound FROM workout_settings WHERE id = 1")
    .first<{ weekly_goal: number; default_rest_s: number; sound: number }>();
  return r
    ? { weeklyGoal: r.weekly_goal, defaultRestS: r.default_rest_s, sound: !!r.sound }
    : { weeklyGoal: 4, defaultRestS: 90, sound: true };
}

/** Os 7 dias da semana fixa; dia sem linha = folga. */
export async function getPlan(db: D1Database): Promise<WorkoutPlanDay[]> {
  const { results } = await db
    .prepare("SELECT weekday, template_id FROM workout_plan")
    .all<{ weekday: number; template_id: string | null }>();
  const map = new Map(results.map((r) => [r.weekday, r.template_id]));
  return Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, templateId: map.get(i + 1) ?? null }));
}

export async function getSession(db: D1Database, id: string): Promise<WorkoutSession | null> {
  const r = await db.prepare("SELECT * FROM workout_sessions WHERE id = ?").bind(id).first<SessionRow>();
  return r ? rowToSession(r) : null;
}

export type WorkoutHistory = { sessions: WorkoutSession[]; sets: WorkoutSet[] };

/** Todo o histórico (usuário único: cabe na memória). Sessões em ordem cronológica. */
export async function loadHistory(db: D1Database): Promise<WorkoutHistory> {
  const [s, x] = await db.batch([
    db.prepare("SELECT * FROM workout_sessions ORDER BY date, started_at, rowid"),
    db.prepare("SELECT * FROM workout_sets ORDER BY exercise_position, set_index, rowid"),
  ]);
  return {
    sessions: (s.results as SessionRow[]).map(rowToSession),
    sets: (x.results as SetRow[]).map(rowToSet),
  };
}
