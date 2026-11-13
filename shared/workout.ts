import { z } from "zod";
import { addDays, nowParts, weekDays, weekStart } from "./dates";
import {
  EXERCISE_NAME_MAX,
  EXERCISE_NAME_MIN,
  WORKOUT_EXERCISES_MAX,
  WORKOUT_FOCUS_MAX,
  WORKOUT_NAME_MAX,
  WORKOUT_NAME_MIN,
} from "./limits";
import type { MedalTier } from "./xp";

/*
 * Aba Treino: regras puras (Worker e tela usam as mesmas).
 * Pesos são GRAMAS inteiros, múltiplos de 500 (82,5 kg = 82500). Datas em AAAA-MM-DD; semana = segunda-feira.
 * XP, brasão, recordes e conquistas são sempre calculados a partir das séries, nunca gravados.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Menor fração de peso aceita (0,5 kg). */
export const WEIGHT_STEP_G = 500;
/** Passo do + / − de peso na tela (2,5 kg). */
export const WEIGHT_ADJUST_G = 2500;
export const WEIGHT_MAX_G = 1_000_000;
export const SETS_MAX = 10;
export const REPS_MAX = 100;
export const REST_MIN_S = 0;
export const REST_MAX_S = 600;
export const REST_ADJUST_S = 15;
export const REST_PRESETS_S = [45, 60, 90, 120, 180] as const;
export const WEEKLY_GOAL_MIN = 3;
export const WEEKLY_GOAL_MAX = 6;

export const SET_XP = 5;
export const SESSION_XP = 50;
export const PR_XP = 30;

/** Volume num dia para a conquista Tonelada (10 t, em gramas). */
export const TONNE_DAY_G = 10_000_000;

// ---------------------------------------------------------------------------
// Schemas de entrada (Zod 4; o Worker valida com readBody)
// ---------------------------------------------------------------------------

const intIn = (min: number, max: number, what: string) =>
  z
    .number({ error: `${what} inválido.` })
    .int(`${what} inválido.`)
    .min(min, `${what} deve ser entre ${min} e ${max}.`)
    .max(max, `${what} deve ser entre ${min} e ${max}.`);

const weightG = z
  .number({ error: "Peso inválido." })
  .int("Peso inválido (use gramas inteiros).")
  .min(0, "O peso não pode ser negativo.")
  .max(WEIGHT_MAX_G, "Peso alto demais.")
  .refine((g) => g % WEIGHT_STEP_G === 0, "O peso deve ser múltiplo de 0,5 kg.");
const templateName = z
  .string({ error: "Nome inválido." })
  .trim()
  .min(WORKOUT_NAME_MIN, "Informe um nome.")
  .max(WORKOUT_NAME_MAX, `O nome deve ter no máximo ${WORKOUT_NAME_MAX} caracteres.`);
const focus = z
  .string({ error: "Foco inválido." })
  .trim()
  .max(WORKOUT_FOCUS_MAX, `O foco deve ter no máximo ${WORKOUT_FOCUS_MAX} caracteres.`);
const exerciseName = z
  .string({ error: "Nome inválido." })
  .trim()
  .min(EXERCISE_NAME_MIN, "Informe o exercício.")
  .max(EXERCISE_NAME_MAX, `O nome deve ter no máximo ${EXERCISE_NAME_MAX} caracteres.`);
const sets = intIn(1, SETS_MAX, "Número de séries");
const targetReps = intIn(1, REPS_MAX, "Repetições");
const doneReps = intIn(0, REPS_MAX, "Repetições");
const restS = intIn(REST_MIN_S, REST_MAX_S, "Descanso");
const weeklyGoal = intIn(WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX, "Meta semanal");
const id = z.string({ error: "Id inválido." }).min(1, "Id inválido.").max(64, "Id inválido.");

export const WorkoutTemplateCreate = z.object({ name: templateName, focus: focus.nullish() });
export type WorkoutTemplateCreate = z.infer<typeof WorkoutTemplateCreate>;

export const WorkoutTemplatePatch = z.object({
  name: templateName.optional(),
  focus: focus.nullable().optional(),
  position: intIn(0, 1000, "Posição").optional(),
});
export type WorkoutTemplatePatch = z.infer<typeof WorkoutTemplatePatch>;

export const WorkoutExerciseCreate = z.object({
  name: exerciseName,
  sets,
  reps: targetReps,
  weightG,
  restS: restS.optional(),
});
export type WorkoutExerciseCreate = z.infer<typeof WorkoutExerciseCreate>;

export const WorkoutExercisePatch = z.object({
  name: exerciseName.optional(),
  sets: sets.optional(),
  reps: targetReps.optional(),
  weightG: weightG.optional(),
  restS: restS.optional(),
});
export type WorkoutExercisePatch = z.infer<typeof WorkoutExercisePatch>;

/** Nova ordem dos exercícios: todos os ids do treino, na ordem desejada. */
export const WorkoutExerciseOrder = z.object({
  ids: z.array(id, { error: "Lista inválida." }).max(WORKOUT_EXERCISES_MAX, "Lista grande demais."),
});
export type WorkoutExerciseOrder = z.infer<typeof WorkoutExerciseOrder>;

export const WorkoutPlanPut = z.object({
  days: z
    .array(
      z.object({ weekday: intIn(1, 7, "Dia da semana"), templateId: id.nullable() }),
      { error: "Lista de dias inválida." },
    )
    .max(7, "No máximo 7 dias.")
    .refine((d) => new Set(d.map((x) => x.weekday)).size === d.length, "Dia da semana repetido."),
  weeklyGoal: weeklyGoal.optional(),
});
export type WorkoutPlanPut = z.infer<typeof WorkoutPlanPut>;

export const WorkoutSettingsPatch = z.object({
  weeklyGoal: weeklyGoal.optional(),
  defaultRestS: restS.optional(),
  sound: z.boolean({ error: "Valor inválido (use true ou false)." }).optional(),
});
export type WorkoutSettingsPatch = z.infer<typeof WorkoutSettingsPatch>;

export const WorkoutSessionStart = z.object({ templateId: id });
export type WorkoutSessionStart = z.infer<typeof WorkoutSessionStart>;

/** Grava uma série (S1 = setIndex 1). Repetir o mesmo exercício+série substitui a anterior. */
export const WorkoutSetCreate = z.object({
  exerciseId: id,
  setIndex: intIn(1, SETS_MAX, "Série"),
  weightG,
  reps: doneReps,
});
export type WorkoutSetCreate = z.infer<typeof WorkoutSetCreate>;

export const WorkoutSetPatch = z.object({ weightG: weightG.optional(), reps: doneReps.optional() });
export type WorkoutSetPatch = z.infer<typeof WorkoutSetPatch>;

// ---------------------------------------------------------------------------
// Tipos das respostas da API (camelCase)
// ---------------------------------------------------------------------------

/** 1 = segunda … 7 = domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WorkoutSettings = { weeklyGoal: number; defaultRestS: number; sound: boolean };

/** Exercício de um treino (alvo: séries × reps · peso). */
export type WorkoutExercise = {
  id: string;
  templateId: string;
  name: string;
  /** Nome normalizado; liga o histórico do exercício. */
  exerciseKey: string;
  position: number;
  sets: number;
  reps: number;
  weightG: number;
  restS: number;
  createdAt: string;
  updatedAt: string;
};

/** Treino (A/B/C) com seus exercícios em ordem. */
export type WorkoutTemplate = {
  id: string;
  name: string;
  focus: string | null;
  position: number;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
};

/** Um dia da semana fixa; templateId null = folga. */
export type WorkoutPlanDay = { weekday: number; templateId: string | null };

export type WorkoutDayStatus = "done" | "missed" | "today" | "future" | "rest";

/** Um dia da semana atual, com status. */
export type WorkoutDay = {
  date: string;
  weekday: number;
  templateId: string | null;
  templateName: string | null;
  status: WorkoutDayStatus;
  /** Sessão concluída nesse dia (status "done"). */
  sessionId: string | null;
};

/** Série feita (gravada no servidor). */
export type WorkoutSet = {
  id: string;
  sessionId: string;
  exerciseKey: string;
  exerciseName: string;
  exercisePosition: number;
  setIndex: number;
  weightG: number;
  reps: number;
  doneAt: string;
};

export type SetPair = { weightG: number; reps: number };

/** Última vez que o exercício foi feito (outra sessão). */
export type LastTime = { date: string; sets: (SetPair & { setIndex: number })[] };

/** Exercício do treino de hoje, com a última vez e se dá para subir a carga. */
export type TodayExercise = WorkoutExercise & { last: LastTime | null; suggestUp: boolean };

/** Resumo da sessão em andamento (para "Continuar treino"). */
export type OpenSessionInfo = {
  id: string;
  templateId: string | null;
  templateName: string;
  date: string;
  startedAt: string;
  setsDone: number;
};

/** GET /api/workout */
export type WorkoutWeekView = {
  today: string;
  /** Segunda-feira da semana atual. */
  week: string;
  /** Número ISO da semana ("Treino · semana 46"). */
  weekNumber: number;
  settings: WorkoutSettings;
  templates: WorkoutTemplate[];
  /** Os 7 dias da semana fixa (weekday 1..7). */
  plan: WorkoutPlanDay[];
  days: WorkoutDay[];
  /** Treino planejado para hoje; null em dia de folga. */
  todayWorkout: { template: WorkoutTemplate; exercises: TodayExercise[] } | null;
  goal: number;
  /** Dias com treino concluído nesta semana (1 por dia). */
  done: number;
  volumeG: number;
  /** XP de treino da semana (sessão aberta incluída). */
  xp: number;
  /** Recordes da semana. */
  prs: number;
  openSession: OpenSessionInfo | null;
  /** Semanas seguidas com a meta cumprida. */
  streak: number;
  medal: MedalTier | null;
  nextMedal: WorkoutNextMedal | null;
};

/** Uma série S1…Sn do exercício na sessão. */
export type SessionSetSlot = {
  setIndex: number;
  /** Valores sugeridos (última vez na mesma série, ou o alvo do treino). */
  prefill: SetPair;
  /** O que foi feito na última vez nesta série ("antes 80×8"). */
  previous: SetPair | null;
  /** A série já feita nesta sessão. */
  done: WorkoutSet | null;
  /** A série feita é recorde pessoal. */
  pr: boolean;
};

export type SessionExercise = {
  /** null quando o exercício saiu do treino depois de feito. */
  exerciseId: string | null;
  name: string;
  exerciseKey: string;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeightG: number;
  restS: number;
  /** "Meta hoje ↑ +2,5 kg": na última vez todas as séries bateram as reps alvo. */
  suggestUp: boolean;
  last: LastTime | null;
  sets: SessionSetSlot[];
};

/** GET/POST /api/workout/sessions[/:id] → { session } */
export type SessionView = {
  id: string;
  date: string;
  templateId: string | null;
  templateName: string;
  startedAt: string;
  finishedAt: string | null;
  xp: number;
  exercises: SessionExercise[];
};

/** POST /api/workout/sessions/:id/sets */
export type SetResult = {
  set: WorkoutSet;
  /** XP ganho com esta gravação (5, ou 35 com o 1º recorde do exercício na sessão). */
  xp: number;
  pr: boolean;
  /** XP total da sessão depois desta gravação. */
  sessionXp: number;
};

export type Trend = "up" | "same" | "down" | "new";

export type SummaryExercise = {
  exerciseKey: string;
  name: string;
  sets: number;
  maxG: number;
  prevMaxG: number | null;
  trend: Trend;
  volumeG: number;
  pr: boolean;
};

/** POST /api/workout/sessions/:id/finish → { summary } */
export type SessionSummary = {
  sessionId: string;
  date: string;
  templateName: string;
  startedAt: string;
  finishedAt: string | null;
  durationS: number | null;
  xp: number;
  sets: number;
  prs: number;
  volumeG: number;
  /** Volume da última vez dos mesmos exercícios; null sem histórico. */
  prevVolumeG: number | null;
  volumeChangePct: number | null;
  exercises: SummaryExercise[];
};

export type ReportExercise = {
  exerciseKey: string;
  name: string;
  maxG: number;
  prevMaxG: number | null;
  deltaG: number | null;
  /** 6 semanas, da mais antiga para esta; maxG null = não fez. */
  history: { week: string; maxG: number | null }[];
  /** Semanas seguidas sem a carga máxima subir. */
  stagnantWeeks: number;
  volumeG: number;
};

export type WeekReport = {
  week: string;
  previousWeek: string;
  exercises: ReportExercise[];
  volumeG: number;
  prevVolumeG: number;
  volumeChangePct: number | null;
  /** "N de M subiram": M = exercícios com semana anterior para comparar. */
  improved: number;
  compared: number;
  tip: { exerciseKey: string; name: string; weeks: number; text: string } | null;
};

export type AchievementId = "constante" | "inquebravel" | "recordista" | "tonelada" | "semana_perfeita" | "madrugador";
export type Achievement = { id: AchievementId; label: string; hint: string; unlocked: boolean };

/** GET /api/workout/report?week=AAAA-MM-DD */
export type WorkoutReportResponse = {
  report: WeekReport;
  achievements: Achievement[];
  /** Semanas com treino concluído, da mais recente para a mais antiga (até 12). */
  weeks: string[];
  stats: { streak: number; bestStreak: number; totalPrs: number; monthVolumeG: number };
};

export type WorkoutNextMedal = { medal: MedalTier; missingWorkouts: number; missingPrs: number };

// ---------------------------------------------------------------------------
// Formatação e datas
// ---------------------------------------------------------------------------

/** "Elevação  Lateral " → "elevacao lateral". */
export function exerciseKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const oneDecimal = (tenths: number): string => {
  const int = Math.trunc(tenths / 10);
  const dec = Math.abs(tenths % 10);
  return dec ? `${int},${dec}` : String(int);
};

/** 82500 → "82,5 kg"; 80000 → "80 kg". */
export function formatKg(weightG: number): string {
  return `${oneDecimal(Math.round(weightG / 100))} kg`;
}

/** 19_600_000 g → "19,6t" (sempre 1 casa). */
export function formatTonnes(g: number): string {
  const t = Math.round(g / 100_000);
  return `${Math.trunc(t / 10)},${Math.abs(t % 10)}t`;
}

/** 1 = segunda … 7 = domingo. */
export function isoWeekday(date: string): Weekday {
  return (weekDays(weekStart(date)).indexOf(date) + 1) as Weekday;
}

/** Número da semana ISO 8601 (a semana pertence ao ano da sua quinta-feira). */
export function isoWeekNumber(date: string): number {
  const thursday = addDays(weekStart(date), 3);
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const days = Math.round((Date.parse(`${thursday}T12:00:00Z`) - Date.parse(`${jan1}T12:00:00Z`)) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

// ---------------------------------------------------------------------------
// XP e recordes
// ---------------------------------------------------------------------------

/** XP de uma série: +5 se teve pelo menos 1 repetição. */
export function setXp(set: Pick<SetPair, "reps">): number {
  return set.reps >= 1 ? SET_XP : 0;
}

/** XP de uma sessão: séries + 50 se concluída + 30 por exercício com recorde. */
export function sessionXp(session: { sets: Pick<SetPair, "reps">[]; finished: boolean }, prs: number): number {
  return session.sets.reduce((s, x) => s + setXp(x), 0) + (session.finished ? SESSION_XP : 0) + prs * PR_XP;
}

/** Recorde: peso maior que o máximo de sessões anteriores. A primeira vez (sem histórico) não conta. */
export function isPersonalRecord(weightG: number, previousMax: number | null | undefined, reps = 1): boolean {
  return reps >= 1 && previousMax != null && weightG > previousMax;
}

/** Sessão como o histórico a enxerga. */
export type HistorySession = { id: string; date: string; startedAt: string; finishedAt: string | null };
type HistorySet = Pick<WorkoutSet, "sessionId" | "exerciseKey" | "weightG" | "reps">;

function maxBySessionKey<S extends HistorySet>(sets: S[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of sets) {
    if (s.reps < 1) continue;
    const m = out.get(s.sessionId) ?? new Map<string, number>();
    m.set(s.exerciseKey, Math.max(m.get(s.exerciseKey) ?? 0, s.weightG));
    out.set(s.sessionId, m);
  }
  return out;
}

/**
 * Exercícios com recorde em cada sessão. `sessions` vem em ordem cronológica;
 * cada sessão é comparada com o máximo das anteriores (recorde conta 1 vez por exercício por sessão).
 */
export function recordsBySession(sessions: HistorySession[], sets: HistorySet[]): Map<string, Set<string>> {
  const bySession = maxBySessionKey(sets);
  const best = new Map<string, number>();
  const out = new Map<string, Set<string>>();
  for (const sess of sessions) {
    const maxes = bySession.get(sess.id) ?? new Map<string, number>();
    const prs = new Set<string>();
    for (const [key, max] of maxes) if (isPersonalRecord(max, best.get(key))) prs.add(key);
    out.set(sess.id, prs);
    for (const [key, max] of maxes) best.set(key, Math.max(best.get(key) ?? 0, max));
  }
  return out;
}

/** Maior peso de cada exercício nas sessões antes de `sessionId` (todas, se não estiver na lista). */
export function priorMaxes(sessions: HistorySession[], sets: HistorySet[], sessionId: string | null): Map<string, number> {
  const before = new Set<string>();
  for (const s of sessions) {
    if (s.id === sessionId) break;
    before.add(s.id);
  }
  const out = new Map<string, number>();
  for (const s of sets) {
    if (s.reps < 1 || !before.has(s.sessionId)) continue;
    out.set(s.exerciseKey, Math.max(out.get(s.exerciseKey) ?? 0, s.weightG));
  }
  return out;
}

/** Última vez de cada exercício entre as sessões dadas (ordem cronológica: a mais recente vence). */
export function lastTimeByKey(
  sessions: HistorySession[],
  sets: Pick<WorkoutSet, "sessionId" | "exerciseKey" | "setIndex" | "weightG" | "reps">[],
): Map<string, LastTime> {
  const order = new Map(sessions.map((s, i) => [s.id, i]));
  const latest = new Map<string, number>();
  for (const s of sets) {
    const i = order.get(s.sessionId);
    if (i === undefined) continue;
    if (i > (latest.get(s.exerciseKey) ?? -1)) latest.set(s.exerciseKey, i);
  }
  const out = new Map<string, LastTime>();
  for (const s of sets) {
    const i = order.get(s.sessionId);
    if (i === undefined || latest.get(s.exerciseKey) !== i) continue;
    const lt = out.get(s.exerciseKey) ?? { date: sessions[i].date, sets: [] };
    lt.sets.push({ setIndex: s.setIndex, weightG: s.weightG, reps: s.reps });
    out.set(s.exerciseKey, lt);
  }
  for (const lt of out.values()) lt.sets.sort((a, b) => a.setIndex - b.setIndex);
  return out;
}

/** Última vez bateu as reps alvo em todas as séries → sugerir subir a carga. */
export function shouldSuggestUp(
  lastSets: (SetPair & { setIndex: number })[] | null | undefined,
  exercise: Pick<WorkoutExercise, "sets" | "reps">,
): boolean {
  return !!lastSets && lastSets.length >= exercise.sets && lastSets.every((s) => s.reps >= exercise.reps);
}

/** Pré-preenchimento de uma série: mesma série da última vez, senão o alvo do treino. */
export function prefill(
  lastSets: (SetPair & { setIndex: number })[] | null | undefined,
  exercise: Pick<WorkoutExercise, "sets" | "reps" | "weightG">,
  setIndex: number,
): SetPair & { suggestUp: boolean } {
  const same = lastSets?.find((s) => s.setIndex === setIndex);
  return {
    weightG: same ? same.weightG : exercise.weightG,
    reps: same ? same.reps : exercise.reps,
    suggestUp: shouldSuggestUp(lastSets, exercise),
  };
}

// ---------------------------------------------------------------------------
// Brasão, sequência e conquistas
// ---------------------------------------------------------------------------

const MEDAL_ORDER: readonly MedalTier[] = ["bronze", "prata", "ouro", "diamante", "supremo"];

/** Treinos necessários para cada brasão com a meta dada. */
function workoutsFor(tier: MedalTier, goal: number): number {
  if (tier === "bronze") return 1;
  if (tier === "prata") return Math.ceil(goal * 0.5);
  if (tier === "ouro") return Math.ceil(goal * 0.75);
  return goal;
}

/** Brasão de treino da semana pela fração de treinos sobre a meta; supremo exige ≥ 3 recordes. */
export function workoutMedal(done: number, goal: number, prs: number): MedalTier | null {
  let tier: MedalTier | null = null;
  for (const t of MEDAL_ORDER) {
    if (done < workoutsFor(t, goal)) break;
    if (t === "supremo" && prs < 3) break;
    tier = t;
  }
  return tier;
}

/** Próximo brasão e o que falta ("falta 1 p/ Diamante"); null no Supremo. */
export function workoutNextMedal(done: number, goal: number, prs: number): WorkoutNextMedal | null {
  const current = workoutMedal(done, goal, prs);
  const next = MEDAL_ORDER[current ? MEDAL_ORDER.indexOf(current) + 1 : 0];
  if (!next) return null;
  return {
    medal: next,
    missingWorkouts: Math.max(0, workoutsFor(next, goal) - done),
    missingPrs: next === "supremo" ? Math.max(0, 3 - prs) : 0,
  };
}

/** Dias com treino concluído por semana (1 por dia). */
export function doneByWeek(sessions: Pick<HistorySession, "date" | "finishedAt">[]): Record<string, number> {
  const dates = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.date));
  const out: Record<string, number> = {};
  for (const d of dates) {
    const w = weekStart(d);
    out[w] = (out[w] ?? 0) + 1;
  }
  return out;
}

/** Semanas seguidas com a meta cumprida. A semana atual só entra quando já cumprida (e não zera antes de acabar). */
export function streakWeeks(weeks: Record<string, number>, goal: number, todayWeek: string): number {
  let n = 0;
  let w = todayWeek;
  if ((weeks[w] ?? 0) >= goal) n++;
  w = addDays(w, -7);
  while ((weeks[w] ?? 0) >= goal) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

/** Maior sequência de semanas com a meta cumprida no histórico. */
export function bestStreak(weeks: Record<string, number>, goal: number): number {
  const ok = Object.keys(weeks)
    .filter((w) => weeks[w] >= goal)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of ok) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Todos os dias planejados da semana foram feitos no próprio dia. */
export function isPerfectWeek(plannedWeekdays: number[], doneDates: Set<string>, week: string): boolean {
  const days = weekDays(week);
  return plannedWeekdays.length > 0 && plannedWeekdays.every((wd) => doneDates.has(days[wd - 1]));
}

/** Treino iniciado antes das 7h (horário de São Paulo). */
export function startedEarly(startedAt: string): boolean {
  return nowParts(new Date(startedAt)).time < "07:00";
}

export type AchievementData = {
  bestStreak: number;
  totalPrs: number;
  maxDayVolumeG: number;
  perfectWeek: boolean;
  earlyStart: boolean;
};

/** Conquistas fixas, calculadas dos dados. */
export function achievements(d: AchievementData): Achievement[] {
  return [
    { id: "constante", label: "Constante", hint: "4 semanas seguidas", unlocked: d.bestStreak >= 4 },
    { id: "inquebravel", label: "Inquebrável", hint: "12 semanas seguidas", unlocked: d.bestStreak >= 12 },
    { id: "recordista", label: "Recordista", hint: "1º recorde", unlocked: d.totalPrs >= 1 },
    { id: "tonelada", label: "Tonelada", hint: "10 t de volume num dia", unlocked: d.maxDayVolumeG >= TONNE_DAY_G },
    {
      id: "semana_perfeita",
      label: "Semana perfeita",
      hint: "todos os dias planejados feitos no próprio dia",
      unlocked: d.perfectWeek,
    },
    { id: "madrugador", label: "Madrugador", hint: "treino iniciado antes das 7h", unlocked: d.earlyStart },
  ];
}

// ---------------------------------------------------------------------------
// Volume, resumo e relatório
// ---------------------------------------------------------------------------

/** Volume (peso × reps), em gramas. */
export function volumeOf(sets: SetPair[]): number {
  return sets.reduce((s, x) => s + x.weightG * x.reps, 0);
}

const pctChange = (now: number, before: number | null): number | null =>
  before ? Math.round(((now - before) / before) * 100) : null;

const maxWeight = (sets: SetPair[]): number =>
  sets.reduce((m, s) => (s.reps >= 1 ? Math.max(m, s.weightG) : m), 0);

const trendOf = (max: number, prev: number | null): Trend =>
  prev === null ? "new" : max > prev ? "up" : max < prev ? "down" : "same";

/**
 * Resumo do fim do treino: cada exercício comparado com a última vez em que foi feito.
 * `previousSets` = séries da sessão anterior mais recente de cada exercício.
 */
export function buildSessionSummary(
  session: Pick<HistorySession, "id" | "date" | "startedAt" | "finishedAt"> & { templateName: string },
  sets: WorkoutSet[],
  previousSets: Pick<WorkoutSet, "exerciseKey" | "weightG" | "reps">[],
  prKeys: Set<string>,
): SessionSummary {
  const ordered = [...sets].sort((a, b) => a.exercisePosition - b.exercisePosition || a.setIndex - b.setIndex);
  const groups = new Map<string, WorkoutSet[]>();
  for (const s of ordered) groups.set(s.exerciseKey, [...(groups.get(s.exerciseKey) ?? []), s]);
  let prevVolume = 0;
  let hasPrev = false;
  const exercises: SummaryExercise[] = [...groups].map(([key, list]) => {
    const prev = previousSets.filter((p) => p.exerciseKey === key);
    const prevMaxG = prev.length ? maxWeight(prev) : null;
    if (prev.length) {
      hasPrev = true;
      prevVolume += volumeOf(prev);
    }
    const maxG = maxWeight(list);
    return {
      exerciseKey: key,
      name: list[list.length - 1].exerciseName,
      sets: list.filter((s) => s.reps >= 1).length,
      maxG,
      prevMaxG,
      trend: trendOf(maxG, prevMaxG),
      volumeG: volumeOf(list),
      pr: prKeys.has(key),
    };
  });
  const volumeG = volumeOf(sets);
  const prevVolumeG = hasPrev ? prevVolume : null;
  const durationS = session.finishedAt
    ? Math.max(0, Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000))
    : null;
  return {
    sessionId: session.id,
    date: session.date,
    templateName: session.templateName,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    durationS,
    xp: sessionXp({ sets, finished: !!session.finishedAt }, prKeys.size),
    sets: sets.filter((s) => s.reps >= 1).length,
    prs: prKeys.size,
    volumeG,
    prevVolumeG,
    volumeChangePct: pctChange(volumeG, prevVolumeG),
    exercises,
  };
}

/** Linha do relatório: uma série de sessão concluída. */
export type ReportRow = { date: string; exerciseKey: string; exerciseName: string; weightG: number; reps: number };

/** Relatório semana × semana anterior (só sessões concluídas). */
export function buildWeekReport(rows: ReportRow[], week: string): WeekReport {
  const previousWeek = addDays(week, -7);
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // exercício → semana → { max, volume }
  const byKey = new Map<string, { name: string; weeks: Map<string, { maxG: number; volumeG: number }> }>();
  const order: string[] = [];
  let volumeG = 0;
  let prevVolumeG = 0;
  for (const r of sorted) {
    const w = weekStart(r.date);
    if (w > week) continue;
    const e = byKey.get(r.exerciseKey) ?? { name: r.exerciseName, weeks: new Map() };
    e.name = r.exerciseName;
    const cell = e.weeks.get(w) ?? { maxG: 0, volumeG: 0 };
    if (r.reps >= 1) cell.maxG = Math.max(cell.maxG, r.weightG);
    cell.volumeG += r.weightG * r.reps;
    e.weeks.set(w, cell);
    byKey.set(r.exerciseKey, e);
    if (w === week) {
      volumeG += r.weightG * r.reps;
      if (!order.includes(r.exerciseKey)) order.push(r.exerciseKey);
    } else if (w === previousWeek) prevVolumeG += r.weightG * r.reps;
  }
  const historyWeeks = Array.from({ length: 6 }, (_, i) => addDays(week, (i - 5) * 7));
  const exercises: ReportExercise[] = order.map((key) => {
    const e = byKey.get(key)!;
    const cur = e.weeks.get(week)!;
    const prevMaxG = e.weeks.get(previousWeek)?.maxG ?? null;
    // Semanas com dados, da mais nova para a mais antiga: conta enquanto a carga não sobe.
    const done = [...e.weeks.keys()].sort().reverse();
    let stagnantWeeks = 0;
    for (let i = 0; i + 1 < done.length; i++) {
      if (e.weeks.get(done[i])!.maxG > e.weeks.get(done[i + 1])!.maxG) break;
      stagnantWeeks++;
    }
    return {
      exerciseKey: key,
      name: e.name,
      maxG: cur.maxG,
      prevMaxG,
      deltaG: prevMaxG === null ? null : cur.maxG - prevMaxG,
      history: historyWeeks.map((w) => ({ week: w, maxG: e.weeks.get(w)?.maxG ?? null })),
      stagnantWeeks,
      volumeG: cur.volumeG,
    };
  });
  const compared = exercises.filter((e) => e.deltaG !== null);
  const stuck = exercises
    .filter((e) => e.stagnantWeeks >= 3)
    .sort((a, b) => b.stagnantWeeks - a.stagnantWeeks)[0];
  return {
    week,
    previousWeek,
    exercises,
    volumeG,
    prevVolumeG,
    volumeChangePct: pctChange(volumeG, prevVolumeG),
    improved: compared.filter((e) => e.deltaG! > 0).length,
    compared: compared.length,
    tip: stuck
      ? {
          exerciseKey: stuck.exerciseKey,
          name: stuck.name,
          weeks: stuck.stagnantWeeks,
          text: `${stuck.name}: carga parada há ${stuck.stagnantWeeks} semanas. Tente +2,5 kg ou 1 a 2 repetições a mais.`,
        }
      : null,
  };
}
