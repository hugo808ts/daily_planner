import { z } from "zod";
import { addDays, weekDays, weekStart } from "./dates";
import type { FinanceSnapshot } from "./finance";
import { MISSION_TITLE_MAX, MISSION_TITLE_MIN } from "./limits";
import { bestStreak, isoWeekNumber, TONNE_DAY_G } from "./workout";
import { levelFromXp, medalFor, XP_BY_DIFFICULTY, type Difficulty, type MedalTier } from "./xp";

/*
 * Herói e Torre: regras puras (Worker e tela usam as mesmas).
 * XP, nível de atributo, nós de trilha, peças, títulos e andares são sempre calculados, nunca gravados.
 * Datas em AAAA-MM-DD; semana = segunda-feira.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Os 5 atributos, na ordem do radar (de cima, no sentido horário). */
export const ATTRIBUTES = ["fisica", "mental", "profissional", "espiritual", "financeira"] as const;
export type AttributeId = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_LABEL: Readonly<Record<AttributeId, string>> = {
  fisica: "Física",
  mental: "Mental",
  profissional: "Profissional",
  espiritual: "Espiritual",
  financeira: "Financeira",
};

/** Área da tarefa → atributo. Pessoal (ou sem área) só conta no nível geral. */
export const AREA_ATTRIBUTE: Readonly<Record<"work" | "school" | "personal", AttributeId | null>> = {
  school: "mental",
  work: "profissional",
  personal: null,
};

/** Valores de XP permitidos numa missão. */
export const MISSION_XP = [5, 10, 20, 35, 50] as const;
export type MissionXp = (typeof MISSION_XP)[number];

/** XP de cada dia com movimentação registrada pelo Agente Finanças. */
export const FINANCE_DAY_XP = 10;
/** Tipos de movimentação que contam um dia de finanças. */
export const FINANCE_XP_TIPOS = ["gasto", "receita", "aporte"] as const;

export type HeroStage = "andarilho" | "patrulheiro" | "guardiao";
/** Nível geral a partir do qual o herói vira Patrulheiro e Guardião. */
export const STAGE_PATRULHEIRO_LEVEL = 10;
export const STAGE_GUARDIAO_LEVEL = 25;
export const STAGE_LABEL: Readonly<Record<HeroStage, string>> = {
  andarilho: "Andarilho",
  patrulheiro: "Patrulheiro",
  guardiao: "Guardião Sombrio",
};

export const RADAR_RADIUS = 88;
/** Escala mínima do radar (Suposição 8): raio = nível ÷ max(5, maior nível). */
export const RADAR_MIN_SCALE = 5;

// ---------------------------------------------------------------------------
// Schemas de entrada (Zod 4; o Worker valida com readBody)
// ---------------------------------------------------------------------------

const missionTitle = z
  .string({ error: "Título inválido." })
  .trim()
  .min(MISSION_TITLE_MIN, "Informe um título.")
  .max(MISSION_TITLE_MAX, `O título deve ter no máximo ${MISSION_TITLE_MAX} caracteres.`);
const attribute = z.enum(ATTRIBUTES, { error: "Atributo inválido." });
const missionXp = z
  .number({ error: "XP inválido." })
  .refine((n): n is MissionXp => (MISSION_XP as readonly number[]).includes(n), `Use um XP entre ${MISSION_XP.join(", ")}.`);
const id = z.string({ error: "Id inválido." }).min(1, "Id inválido.").max(64, "Id inválido.");

export const MissionCreate = z.object({ title: missionTitle, attribute, xp: missionXp });
export type MissionCreate = z.infer<typeof MissionCreate>;

export const MissionPatch = z.object({
  title: missionTitle.optional(),
  attribute: attribute.optional(),
  xp: missionXp.optional(),
});
export type MissionPatch = z.infer<typeof MissionPatch>;

export const MissionOrder = z.object({ ids: z.array(id, { error: "Lista inválida." }).max(50, "Lista grande demais.") });
export type MissionOrder = z.infer<typeof MissionOrder>;

export const MissionCheckPut = z.object({ done: z.boolean({ error: "Valor inválido (use true ou false)." }) });
export type MissionCheckPut = z.infer<typeof MissionCheckPut>;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Missão como o banco guarda. */
export type MissionBase = {
  id: string;
  title: string;
  attribute: AttributeId;
  xp: number;
  position: number;
  startDate: string;
  /** null = ativa. A missão deixa de valer a partir deste dia. */
  archivedDate: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Missão na API: `hasChecks` trava XP e atributo; `streak` = dias seguidos feitos até a data pedida. */
export type Mission = MissionBase & { hasChecks: boolean; streak: number };
/** Missão vista num dia (GET /api/missions). */
export type MissionDay = Mission & { done: boolean };

export type MissionCheck = { missionId: string; date: string };

/** Estado de uma seteira da torre (e dos pontinhos da semana nas missões). */
export type WindowState = "lit" | "dark" | "today" | "future";

/** GET /api/missions */
export type MissionsDayView = {
  date: string;
  today: string;
  missions: MissionDay[];
  /** Dia cumprido: ao menos 1 missão valendo e todas feitas. */
  complete: boolean;
  /** Dias seguidos cumpridos até `date`. */
  dayStreak: number;
  /** 7 estados (segunda a domingo) da semana de `date`. */
  week: WindowState[];
};

/** PUT /api/missions/:id/checks/:date. `xp` = XP de missões feitas naquele dia. */
export type MissionCheckResult = { mission: MissionDay; xp: number; complete: boolean; dayStreak: number };

export type AttributeSources = { tasks: number; missions: number; workout: number; finance: number };
export type AttributeView = {
  id: AttributeId;
  label: string;
  xp: number;
  level: number;
  into: number;
  needed: number;
  /** XP por fonte (a trilha devolve também em %). */
  sources: AttributeSources;
};

export type GearId = "elmo" | "gibao" | "arco" | "capa" | "mascara" | "amuleto";
export type TrailReward = { kind: "title"; label: string } | { kind: "gear"; label: string; gear: GearId };

export type TrailNode = {
  /** 1 a 5 (I a V). */
  n: number;
  /** Marco ("4 semanas seguidas com a meta"). */
  title: string;
  /** Explicação curta de como chegar. */
  hint: string;
  reward: TrailReward;
  /** Progresso, limitado ao alvo. */
  current: number;
  target: number;
  done: boolean;
  /** Dia em que destravou (calculado), null se ainda não. */
  unlockedOn: string | null;
};

export type GearView = { id: GearId; label: string; stage: HeroStage; unlockedOn: string | null };

export type TowerFloor = {
  /** Segunda-feira da semana. */
  week: string;
  weekNumber: number;
  /** Brasão de tarefas da semana (cor do estandarte); null = sem estandarte. */
  medal: MedalTier | null;
  windows: WindowState[];
  litDays: number;
  /** Semana bateu a meta de treino (meta atual). */
  trainFlag: boolean;
  /** Andar atual (em obra). */
  current: boolean;
};

/** GET /api/hero */
export type HeroView = {
  today: string;
  level: number;
  into: number;
  needed: number;
  totalXp: number;
  stage: HeroStage;
  stageLabel: string;
  /** Título do nó mais recente destravado; sem título, o nome do estágio. */
  title: string;
  attributes: Record<AttributeId, AttributeView>;
  gear: GearView[];
  dayStreak: number;
  /** Da primeira semana com atividade até a atual, de baixo para cima. */
  tower: TowerFloor[];
};

/** GET /api/hero/trail/:attr */
export type HeroTrailView = {
  attribute: AttributeView & { sourcesPct: AttributeSources };
  nodes: TrailNode[];
};

export type UnlockedNode = { attribute: AttributeId; node: TrailNode };

/** GET /api/hero/week?start= (revelação de domingo). */
export type HeroWeekView = {
  start: string;
  floor: TowerFloor | null;
  unlocked: UnlockedNode[];
  gear: GearView[];
  stageBefore: HeroStage;
  stageAfter: HeroStage;
};

// ---------------------------------------------------------------------------
// Missões
// ---------------------------------------------------------------------------

/** A missão vale no dia: start_date ≤ D e (sem arquivamento ou D < archived_date). */
export function missionActiveOn(m: Pick<MissionBase, "startDate" | "archivedDate">, date: string): boolean {
  return m.startDate <= date && (m.archivedDate === null || date < m.archivedDate);
}

const checkKey = (missionId: string, date: string) => `${missionId}|${date}`;

/** Dia cumprido: ao menos 1 missão valendo e todas feitas. */
export function dayComplete(
  missions: Pick<MissionBase, "id" | "startDate" | "archivedDate">[],
  checks: MissionCheck[],
  date: string,
): boolean {
  const active = missions.filter((m) => missionActiveOn(m, date));
  if (!active.length) return false;
  const done = new Set(checks.filter((c) => c.date === date).map((c) => c.missionId));
  return active.every((m) => done.has(m.id));
}

/** Todos os dias cumpridos do histórico. */
export function completeDates(
  missions: Pick<MissionBase, "id" | "startDate" | "archivedDate">[],
  checks: MissionCheck[],
): Set<string> {
  const byDate = new Map<string, Set<string>>();
  for (const c of checks) byDate.set(c.date, (byDate.get(c.date) ?? new Set()).add(c.missionId));
  const out = new Set<string>();
  for (const [date, done] of byDate) {
    const active = missions.filter((m) => missionActiveOn(m, date));
    if (active.length && active.every((m) => done.has(m.id))) out.add(date);
  }
  return out;
}

/**
 * Dias seguidos com a data no conjunto, terminando em `today`.
 * Hoje entra só quando já está no conjunto e não zera a sequência antes de acabar (regra de `streakWeeks`).
 */
export function missionStreak(dates: Iterable<string>, today: string): number {
  const set = dates instanceof Set ? (dates as Set<string>) : new Set(dates);
  let n = 0;
  let d = today;
  if (set.has(d)) n++;
  d = addDays(d, -1);
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Dias cumpridos seguidos (chama do Herói), com a mesma regra de `missionStreak`. */
export function daysStreak(complete: Iterable<string>, today: string): number {
  return missionStreak(complete, today);
}

/** XP de missões por semana (chave = segunda-feira). */
export function missionXpByWeek(missions: Pick<MissionBase, "id" | "xp">[], checks: MissionCheck[]): Record<string, number> {
  const xp = new Map(missions.map((m) => [m.id, m.xp]));
  const out: Record<string, number> = {};
  for (const c of checks) {
    const w = weekStart(c.date);
    out[w] = (out[w] ?? 0) + (xp.get(c.missionId) ?? 0);
  }
  return out;
}

/** Estado de uma seteira/pontinho: dias futuros fechados; hoje verde até ser cumprido. */
export function windowState(date: string, today: string, complete: boolean): WindowState {
  if (date > today) return "future";
  if (complete) return "lit";
  return date === today ? "today" : "dark";
}

/** Os 7 estados da semana de `date`. */
export function weekWindows(date: string, today: string, complete: Set<string>): WindowState[] {
  return weekDays(weekStart(date)).map((d) => windowState(d, today, complete.has(d)));
}

// ---------------------------------------------------------------------------
// Finanças
// ---------------------------------------------------------------------------

/** Datas distintas (em ordem) com ao menos 1 movimentação gasto/receita/aporte. */
export function financeDaysFrom(snapshot: Pick<FinanceSnapshot, "movimentacoes">): string[] {
  const tipos = new Set<string>(FINANCE_XP_TIPOS);
  return [...new Set(snapshot.movimentacoes.filter((m) => tipos.has(m.tipo)).map((m) => m.data))].sort();
}

// ---------------------------------------------------------------------------
// Estágio, atributos e radar
// ---------------------------------------------------------------------------

export function heroStage(level: number): HeroStage {
  if (level >= STAGE_GUARDIAO_LEVEL) return "guardiao";
  if (level >= STAGE_PATRULHEIRO_LEVEL) return "patrulheiro";
  return "andarilho";
}

const taskXpOf = (difficulty: string, n: number) => (XP_BY_DIFFICULTY[difficulty as Difficulty] ?? 0) * n;
const areaAttribute = (area: string | null): AttributeId | null =>
  area && area in AREA_ATTRIBUTE ? AREA_ATTRIBUTE[area as keyof typeof AREA_ATTRIBUTE] : null;

export type TaskXpRow = { area: string | null; difficulty: string; n: number };
export type MissionXpRow = { attribute: AttributeId; xp: number };

/** XP, nível e fontes de cada atributo. `missionRows` = uma linha por marcação; `financeDays` = quantos dias. */
export function attributeXp(input: {
  taskRows: TaskXpRow[];
  missionRows: MissionXpRow[];
  workoutXp: number;
  financeDays: number;
}): Record<AttributeId, AttributeView> {
  const src = Object.fromEntries(
    ATTRIBUTES.map((a) => [a, { tasks: 0, missions: 0, workout: 0, finance: 0 } as AttributeSources]),
  ) as Record<AttributeId, AttributeSources>;
  for (const r of input.taskRows) {
    const a = areaAttribute(r.area);
    if (a) src[a].tasks += taskXpOf(r.difficulty, r.n);
  }
  for (const r of input.missionRows) src[r.attribute].missions += r.xp;
  src.fisica.workout += input.workoutXp;
  src.financeira.finance += input.financeDays * FINANCE_DAY_XP;
  const out = {} as Record<AttributeId, AttributeView>;
  for (const a of ATTRIBUTES) {
    const s = src[a];
    const xp = s.tasks + s.missions + s.workout + s.finance;
    out[a] = { id: a, label: ATTRIBUTE_LABEL[a], xp, ...levelFromXp(xp), sources: s };
  }
  return out;
}

/** Fontes em % (inteiros que somam 100; tudo 0 sem XP). */
export function sourcesPct(s: AttributeSources): AttributeSources {
  const total = s.tasks + s.missions + s.workout + s.finance;
  if (!total) return { tasks: 0, missions: 0, workout: 0, finance: 0 };
  const keys = ["tasks", "missions", "workout", "finance"] as const;
  const pct = Object.fromEntries(keys.map((k) => [k, Math.floor((s[k] / total) * 100)])) as AttributeSources;
  // Sobra do arredondamento vai para a maior fonte.
  const rest = 100 - keys.reduce((n, k) => n + pct[k], 0);
  const top = keys.reduce((a, b) => (s[b] > s[a] ? b : a));
  pct[top] += rest;
  return pct;
}

/** Pontos do pentágono (centro 0,0), na ordem de ATTRIBUTES; eixos em -90°, -18°, 54°, 126°, 198°. */
export function radarPoints(
  levels: Record<AttributeId, number>,
  radius = RADAR_RADIUS,
): { id: AttributeId; x: number; y: number }[] {
  const scale = Math.max(RADAR_MIN_SCALE, ...ATTRIBUTES.map((a) => levels[a] || 0));
  const round = (n: number) => Math.round(n * 100) / 100 + 0; // + 0 tira o -0
  return ATTRIBUTES.map((a, i) => {
    const r = ((levels[a] || 0) / scale) * radius;
    const ang = ((-90 + 72 * i) * Math.PI) / 180;
    return { id: a, x: round(r * Math.cos(ang)), y: round(r * Math.sin(ang)) };
  });
}

// ---------------------------------------------------------------------------
// Trilhas, peças e títulos
// ---------------------------------------------------------------------------

/** Fatos com data que o Worker monta a partir do banco. */
export type HeroFacts = {
  /** Tarefas feitas agrupadas por dia, área e dificuldade. */
  taskRows: (TaskXpRow & { date: string })[];
  /** Uma linha por marcação de missão. */
  missionChecks: (MissionXpRow & { date: string })[];
  /** Sessões de treino com XP, recordes e volume. */
  workoutSessions: { date: string; finished: boolean; xp: number; prs: number; volumeG: number }[];
  /** Dias de finanças (distintos). */
  financeDays: string[];
  /** Meta semanal de treino atual. */
  weeklyGoal: number;
};

type Progress = { current: number; unlockedOn: string | null };

/** n-ésimo evento (datas, uma por evento). */
function countProgress(dates: string[], target: number): Progress {
  const sorted = [...dates].sort();
  return { current: sorted.length, unlockedOn: sorted[target - 1] ?? null };
}

/** Maior sequência de dias seguidos; destrava no primeiro dia em que a sequência chegou ao alvo. */
function dayStreakProgress(dates: string[], target: number): Progress {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  let unlockedOn: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    if (!unlockedOn && run >= target) unlockedOn = d;
    prev = d;
  }
  return { current: best, unlockedOn };
}

/**
 * Semanas seguidas com ao menos `perWeek` eventos. A semana conta no dia do evento que a completou;
 * destrava no dia em que a sequência chegou ao alvo. `current` = maior sequência (`bestStreak`).
 */
function weekStreakProgress(dates: string[], perWeek: number, target: number): Progress {
  const sorted = [...dates].sort();
  const counts: Record<string, number> = {};
  let run = 0;
  let prevOk: string | null = null;
  let unlockedOn: string | null = null;
  for (const d of sorted) {
    const w = weekStart(d);
    counts[w] = (counts[w] ?? 0) + 1;
    if (counts[w] !== perWeek) continue;
    run = prevOk && addDays(prevOk, 7) === w ? run + 1 : 1;
    prevOk = w;
    if (!unlockedOn && run >= target) unlockedOn = d;
  }
  return { current: bestStreak(counts, perWeek), unlockedOn };
}

/** Nível do atributo; destrava no primeiro dia em que o XP acumulado chegou ao nível alvo. */
function levelProgress(events: { date: string; xp: number }[], target: number): Progress {
  const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let total = 0;
  let unlockedOn: string | null = null;
  for (const e of sorted) {
    total += e.xp;
    if (!unlockedOn && levelFromXp(total).level >= target) unlockedOn = e.date;
  }
  return { current: levelFromXp(total).level, unlockedOn };
}

/** Eventos de XP com data de um atributo (para os nós de nível). */
export function attributeXpEvents(facts: HeroFacts, attr: AttributeId): { date: string; xp: number }[] {
  const out: { date: string; xp: number }[] = [];
  for (const r of facts.taskRows) if (areaAttribute(r.area) === attr) out.push({ date: r.date, xp: taskXpOf(r.difficulty, r.n) });
  for (const c of facts.missionChecks) if (c.attribute === attr) out.push({ date: c.date, xp: c.xp });
  if (attr === "fisica") for (const s of facts.workoutSessions) out.push({ date: s.date, xp: s.xp });
  if (attr === "financeira") for (const d of facts.financeDays) out.push({ date: d, xp: FINANCE_DAY_XP });
  return out;
}

/** Fatos até `today` (inclusive). */
function factsUntil(f: HeroFacts, today: string): HeroFacts {
  return {
    taskRows: f.taskRows.filter((r) => r.date <= today),
    missionChecks: f.missionChecks.filter((r) => r.date <= today),
    workoutSessions: f.workoutSessions.filter((r) => r.date <= today),
    financeDays: f.financeDays.filter((d) => d <= today),
    weeklyGoal: f.weeklyGoal,
  };
}

const repeatDates = (rows: { date: string; n: number }[]) => rows.flatMap((r) => Array<string>(r.n).fill(r.date));
const missionDays = (f: HeroFacts, attr: AttributeId) => [
  ...new Set(f.missionChecks.filter((c) => c.attribute === attr).map((c) => c.date)),
];

type TrailDef = {
  title: string;
  hint: string;
  reward: TrailReward;
  target: number;
  progress: (f: HeroFacts, target: number) => Progress;
};

const title = (label: string): TrailReward => ({ kind: "title", label });
const gear = (g: GearId, label: string): TrailReward => ({ kind: "gear", label, gear: g });

const finishedDates = (f: HeroFacts) => f.workoutSessions.filter((s) => s.finished).map((s) => s.date);
const tasksOf = (f: HeroFacts, area: string, difficulty?: string) =>
  repeatDates(f.taskRows.filter((r) => r.area === area && (!difficulty || r.difficulty === difficulty)));

/** Trilhas (valores iniciais, Suposição 5): 5 nós por atributo. */
export const TRAILS: Readonly<Record<AttributeId, readonly TrailDef[]>> = {
  fisica: [
    { title: "1 treino concluído", hint: "Conclua um treino.", reward: title("Iniciante"), target: 1, progress: (f, t) => countProgress(finishedDates(f), t) },
    {
      title: "4 semanas seguidas com a meta",
      hint: "Bata a meta semanal de treinos 4 semanas seguidas.",
      reward: gear("elmo", "Elmo"),
      target: 4,
      progress: (f, t) => weekStreakProgress([...new Set(finishedDates(f))], f.weeklyGoal, t),
    },
    {
      title: "5 recordes",
      hint: "Supere o maior peso de um exercício 5 vezes.",
      reward: title("Recordista"),
      target: 5,
      progress: (f, t) => countProgress(repeatDates(f.workoutSessions.map((s) => ({ date: s.date, n: s.prs }))), t),
    },
    {
      title: "10 t num dia",
      hint: "Some 10 toneladas de volume (peso × repetições) num dia.",
      reward: gear("capa", "Capa"),
      target: 1,
      progress: (f, t) => {
        const byDay = new Map<string, number>();
        for (const s of f.workoutSessions) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.volumeG);
        return countProgress([...byDay].filter(([, v]) => v >= TONNE_DAY_G).map(([d]) => d), t);
      },
    },
    {
      title: "12 semanas seguidas",
      hint: "Bata a meta semanal de treinos 12 semanas seguidas.",
      reward: title("Inquebrável"),
      target: 12,
      progress: (f, t) => weekStreakProgress([...new Set(finishedDates(f))], f.weeklyGoal, t),
    },
  ],
  mental: [
    { title: "1 tarefa de Faculdade", hint: "Conclua uma tarefa da área Faculdade.", reward: title("Aprendiz"), target: 1, progress: (f, t) => countProgress(tasksOf(f, "school"), t) },
    {
      title: "7 dias seguidos com missão Mental",
      hint: "Faça uma missão Mental 7 dias seguidos.",
      reward: gear("gibao", "Gibão"),
      target: 7,
      progress: (f, t) => dayStreakProgress(missionDays(f, "mental"), t),
    },
    { title: "30 tarefas de Faculdade", hint: "Conclua 30 tarefas da área Faculdade.", reward: title("Estudioso"), target: 30, progress: (f, t) => countProgress(tasksOf(f, "school"), t) },
    { title: "Mental nível 8", hint: "Chegue ao nível 8 em Mental.", reward: title("Erudito"), target: 8, progress: (f, t) => levelProgress(attributeXpEvents(f, "mental"), t) },
    { title: "60 dias com missão Mental", hint: "Faça uma missão Mental em 60 dias.", reward: title("Sábio"), target: 60, progress: (f, t) => countProgress(missionDays(f, "mental"), t) },
  ],
  profissional: [
    { title: "1 tarefa de Trabalho", hint: "Conclua uma tarefa da área Trabalho.", reward: title("Aprendiz de ofício"), target: 1, progress: (f, t) => countProgress(tasksOf(f, "work"), t) },
    { title: "10 tarefas difíceis de Trabalho", hint: "Conclua 10 tarefas difíceis da área Trabalho.", reward: gear("arco", "Arco"), target: 10, progress: (f, t) => countProgress(tasksOf(f, "work", "high"), t) },
    { title: "50 tarefas de Trabalho", hint: "Conclua 50 tarefas da área Trabalho.", reward: title("Artesão"), target: 50, progress: (f, t) => countProgress(tasksOf(f, "work"), t) },
    {
      title: "4 semanas seguidas com 5 tarefas de Trabalho",
      hint: "Conclua ao menos 5 tarefas de Trabalho por semana, 4 semanas seguidas.",
      reward: title("Mestre de ofício"),
      target: 4,
      progress: (f, t) => weekStreakProgress(tasksOf(f, "work"), 5, t),
    },
    { title: "Profissional nível 10", hint: "Chegue ao nível 10 em Profissional.", reward: title("Lenda do ofício"), target: 10, progress: (f, t) => levelProgress(attributeXpEvents(f, "profissional"), t) },
  ],
  espiritual: [
    { title: "1 missão Espiritual", hint: "Faça uma missão Espiritual.", reward: title("Buscador"), target: 1, progress: (f, t) => countProgress(missionDays(f, "espiritual"), t) },
    { title: "7 dias seguidos", hint: "Faça uma missão Espiritual 7 dias seguidos.", reward: title("Sereno"), target: 7, progress: (f, t) => dayStreakProgress(missionDays(f, "espiritual"), t) },
    { title: "30 dias no total", hint: "Faça uma missão Espiritual em 30 dias.", reward: title("Monge"), target: 30, progress: (f, t) => countProgress(missionDays(f, "espiritual"), t) },
    { title: "30 dias seguidos", hint: "Faça uma missão Espiritual 30 dias seguidos.", reward: gear("mascara", "Máscara"), target: 30, progress: (f, t) => dayStreakProgress(missionDays(f, "espiritual"), t) },
    { title: "100 dias no total", hint: "Faça uma missão Espiritual em 100 dias.", reward: title("Iluminado"), target: 100, progress: (f, t) => countProgress(missionDays(f, "espiritual"), t) },
  ],
  financeira: [
    { title: "1º dia registrado", hint: "Registre uma movimentação com o Agente Finanças.", reward: title("Contador"), target: 1, progress: (f, t) => countProgress(f.financeDays, t) },
    { title: "7 dias seguidos registrando", hint: "Registre movimentações 7 dias seguidos.", reward: title("Atento"), target: 7, progress: (f, t) => dayStreakProgress(f.financeDays, t) },
    { title: "30 dias registrados", hint: "Registre movimentações em 30 dias.", reward: title("Tesoureiro"), target: 30, progress: (f, t) => countProgress(f.financeDays, t) },
    { title: "90 dias registrados", hint: "Registre movimentações em 90 dias.", reward: gear("amuleto", "Amuleto"), target: 90, progress: (f, t) => countProgress(f.financeDays, t) },
    { title: "Financeira nível 10", hint: "Chegue ao nível 10 em Financeira.", reward: title("Guardião do tesouro"), target: 10, progress: (f, t) => levelProgress(attributeXpEvents(f, "financeira"), t) },
  ],
};

/** Os 5 nós de um atributo com progresso e data de destrave (só fatos até `today`). */
export function trailProgress(attr: AttributeId, facts: HeroFacts, today: string): TrailNode[] {
  const f = factsUntil(facts, today);
  return TRAILS[attr].map((def, i) => {
    const p = def.progress(f, def.target);
    return {
      n: i + 1,
      title: def.title,
      hint: def.hint,
      reward: def.reward,
      current: Math.min(p.current, def.target),
      target: def.target,
      done: p.unlockedOn !== null,
      unlockedOn: p.unlockedOn,
    };
  });
}

/** Todas as trilhas. */
export function allTrails(facts: HeroFacts, today: string): Record<AttributeId, TrailNode[]> {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, trailProgress(a, facts, today)])) as Record<AttributeId, TrailNode[]>;
}

/** As 6 peças e o estágio em que aparecem no desenho. */
export const GEAR: readonly { id: GearId; label: string; stage: HeroStage }[] = [
  { id: "elmo", label: "Elmo", stage: "patrulheiro" },
  { id: "gibao", label: "Gibão", stage: "patrulheiro" },
  { id: "arco", label: "Arco", stage: "patrulheiro" },
  { id: "capa", label: "Capa", stage: "guardiao" },
  { id: "mascara", label: "Máscara", stage: "guardiao" },
  { id: "amuleto", label: "Amuleto", stage: "guardiao" },
];

export function gearFrom(trails: Record<AttributeId, TrailNode[]>): GearView[] {
  const nodes = ATTRIBUTES.flatMap((a) => trails[a] ?? []);
  return GEAR.map((g) => {
    const node = nodes.find((n) => n.reward.kind === "gear" && n.reward.gear === g.id);
    return { ...g, unlockedOn: node?.unlockedOn ?? null };
  });
}

/** Título do nó com título destravado mais recente; null sem nenhum. */
export function currentTitle(trails: Record<AttributeId, TrailNode[]>): string | null {
  let best: { date: string; label: string } | null = null;
  for (const a of ATTRIBUTES) {
    for (const n of trails[a] ?? []) {
      if (n.reward.kind !== "title" || !n.unlockedOn) continue;
      if (!best || n.unlockedOn >= best.date) best = { date: n.unlockedOn, label: n.reward.label };
    }
  }
  return best?.label ?? null;
}

/** Nós destravados entre `from` e `to` (inclusive). */
export function unlockedBetween(trails: Record<AttributeId, TrailNode[]>, from: string, to: string): UnlockedNode[] {
  return ATTRIBUTES.flatMap((a) =>
    (trails[a] ?? []).filter((n) => n.unlockedOn && n.unlockedOn >= from && n.unlockedOn <= to).map((node) => ({ attribute: a, node })),
  );
}

// ---------------------------------------------------------------------------
// Torre
// ---------------------------------------------------------------------------

/**
 * Andares da torre, de baixo para cima: da semana `firstWeek` (primeira com atividade; null = só a atual)
 * até a semana de `today`. `weeks` = XP de tarefas seg–sáb por semana (brasão).
 */
export function buildTower(input: {
  weeks: Record<string, number>;
  completeDates: Set<string>;
  trainDoneByWeek: Record<string, number>;
  goal: number;
  today: string;
  firstWeek: string | null;
}): TowerFloor[] {
  const currentWeek = weekStart(input.today);
  let w = input.firstWeek ? weekStart(input.firstWeek) : currentWeek;
  if (w > currentWeek) w = currentWeek;
  const out: TowerFloor[] = [];
  for (; w <= currentWeek; w = addDays(w, 7)) {
    const windows = weekDays(w).map((d) => windowState(d, input.today, input.completeDates.has(d)));
    out.push({
      week: w,
      weekNumber: isoWeekNumber(w),
      medal: medalFor(input.weeks[w] ?? 0),
      windows,
      litDays: windows.filter((s) => s === "lit").length,
      trainFlag: (input.trainDoneByWeek[w] ?? 0) >= input.goal,
      current: w === currentWeek,
    });
  }
  return out;
}
