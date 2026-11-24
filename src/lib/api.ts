import type { FinanceResponse } from "../../shared/finance";
import type { Area, CaptureResult, DayNote, Folder, Idea, Task, TodoView, WeekReport } from "../../shared/types";
import type {
  SessionSummary,
  SessionView,
  SetResult,
  WorkoutExercise,
  WorkoutExerciseCreate,
  WorkoutExercisePatch,
  WorkoutPlanDay,
  WorkoutPlanPut,
  WorkoutReportResponse,
  WorkoutSetCreate,
  WorkoutSetPatch,
  WorkoutSettings,
  WorkoutSettingsPatch,
  WorkoutTemplate,
  WorkoutTemplateCreate,
  WorkoutTemplatePatch,
  WorkoutWeekView,
} from "../../shared/workout";
import type { Difficulty, MedalTier } from "../../shared/xp";
import type {
  Mission,
  MissionCheckResult,
  MissionCreate,
  MissionPatch,
  MissionsDayView,
} from "../../shared/hero";

export class ApiError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

export interface WeekData {
  start: string;
  days: string[];
  tasks: Task[];
  notes: DayNote[];
}

export interface NewTask {
  title: string;
  /** null = sem data (lista "A fazer"). */
  date: string | null;
  time?: string | null;
  area?: Area | null;
  /** Padrão no servidor: "medium". */
  difficulty?: Difficulty;
}

export interface TaskPatch {
  title?: string;
  date?: string | null;
  time?: string | null;
  area?: Area | null;
  difficulty?: Difficulty;
  done?: boolean;
}

/** Nível (começa em 1), XP já feito nele e XP necessário para o próximo (shared/xp levelFromXp). */
export interface LevelInfo {
  level: number;
  into: number;
  needed: number;
}

/** Resposta completa de GET /api/report. */
export interface ReportData {
  report: WeekReport;
  /** XP (seg–sáb) da semana anterior. */
  previousXp: number;
  /** Maior XP (seg–sáb) de uma semana do histórico até esta, inclusive. */
  bestWeekXp: number;
  /** Nível com o XP total até o domingo desta semana. */
  level: LevelInfo;
  /** Número do nível antes desta semana (para o "Subiu de nível"). */
  levelBefore: number;
}

/** GET /api/progress: nível (XP total, domingo incluído) e medalha da semana (seg–sáb). */
export interface Progress extends LevelInfo {
  totalXp: number;
  weekXp: number;
  medal: MedalTier | null;
  next: { medal: MedalTier; missing: number } | null;
}

export interface NewFolder {
  name: string;
  emoji?: string | null;
}

export interface NewIdea {
  folderId: string;
  title: string;
  body?: string;
  linkUrl?: string | null;
}

export interface FolderPatch {
  name?: string;
  emoji?: string | null;
}

export interface IdeaPatch {
  title?: string;
  body?: string;
  linkUrl?: string | null;
  pinned?: boolean;
  folderId?: string;
}

/** Resultado da busca: a ideia com o nome da pasta onde mora. */
export type FoundIdea = Idea & { folderName: string };

export interface MoveResult {
  task: Task;
  copied: boolean;
}

/** Corpo em JSON, ou um Blob enviado como está (com o tipo dele). */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  const blob = body instanceof Blob ? body : null;
  try {
    res = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": blob ? blob.type || "application/octet-stream" : "application/json" },
      body: body === undefined ? undefined : blob ?? JSON.stringify(body),
      redirect: "manual",
    });
  } catch {
    throw new ApiError("Sem conexão. Verifique a internet e tente de novo.", 0);
  }
  // Sessão do Cloudflare Access vencida: o Access redireciona para o login (ou o Worker devolve 401).
  if (res.type === "opaqueredirect" || res.status === 401) {
    location.reload();
    throw new ApiError("Sessão expirada. Entrando de novo…", 401);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Resposta sem JSON (ex.: erro do proxy): tratada abaixo.
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    throw new ApiError(err.error ?? `Algo deu errado (erro ${res.status}).`, res.status, err.fields);
  }
  return data as T;
}

const enc = encodeURIComponent;
const tpl = (id: string) => `/api/workout/templates/${enc(id)}`;
const sess = (id: string) => `/api/workout/sessions/${enc(id)}`;

const json = (method: string, path: string, body?: unknown) => request<Record<string, unknown>>(method, path, body);

export const api = {
  week: (start: string) => request<WeekData>("GET", `/api/week?start=${encodeURIComponent(start)}`),
  report: async (start: string) =>
    (await json("GET", `/api/report?start=${encodeURIComponent(start)}`)).report as WeekReport,
  /** O resumo com o XP comparado (semana anterior, melhor semana, nível). */
  reportData: (start: string) => request<ReportData>("GET", `/api/report?start=${encodeURIComponent(start)}`),
  progress: (start: string) => request<Progress>("GET", `/api/progress?start=${encodeURIComponent(start)}`),
  createTask: async (input: NewTask) => (await json("POST", "/api/tasks", input)).task as Task,
  updateTask: async (id: string, patch: TaskPatch) =>
    (await json("PATCH", `/api/tasks/${encodeURIComponent(id)}`, patch)).task as Task,
  deleteTask: async (id: string) => {
    await json("DELETE", `/api/tasks/${encodeURIComponent(id)}`);
  },
  /** Lista "A fazer" do dia: sem data (pendentes + feitas no dia) e compromissos do dia. */
  todo: (date: string) => request<TodoView>("GET", `/api/todo?date=${encodeURIComponent(date)}`),
  moveTask: (id: string, date: string) =>
    request<MoveResult>("POST", `/api/tasks/${encodeURIComponent(id)}/move`, { date }),
  saveDayNote: async (date: string, text: string) =>
    (await json("PUT", `/api/day-notes/${encodeURIComponent(date)}`, { text })).note as DayNote | null,
  capture: async (text: string) => (await json("POST", "/api/capture", { text })).result as CaptureResult,
  transcribe: async (audio: Blob) => (await json("POST", "/api/transcribe", audio)).text as string,
  folders: async () => (await json("GET", "/api/folders")).folders as Folder[],
  createFolder: async (input: NewFolder) => (await json("POST", "/api/folders", input)).folder as Folder,
  createIdea: async (input: NewIdea) => (await json("POST", "/api/ideas", input)).idea as Idea,
  updateFolder: async (id: string, patch: FolderPatch) =>
    (await json("PATCH", `/api/folders/${encodeURIComponent(id)}`, patch)).folder as Folder,
  deleteFolder: async (id: string) => {
    await json("DELETE", `/api/folders/${encodeURIComponent(id)}`);
  },
  ideas: async (folderId: string) =>
    (await json("GET", `/api/folders/${encodeURIComponent(folderId)}/ideas`)).ideas as Idea[],
  updateIdea: async (id: string, patch: IdeaPatch) =>
    (await json("PATCH", `/api/ideas/${encodeURIComponent(id)}`, patch)).idea as Idea,
  /** Devolve o registro apagado, para o Desfazer. */
  deleteIdea: async (id: string) => (await json("DELETE", `/api/ideas/${encodeURIComponent(id)}`)).idea as Idea,
  restoreIdea: async (idea: Idea) => (await json("POST", "/api/ideas/restore", { idea })).idea as Idea,
  /** Painel financeiro do mês (AAAA-MM); sem mês, o servidor usa o mês atual. */
  finance: (month?: string) =>
    request<FinanceResponse>("GET", month ? `/api/finance?month=${encodeURIComponent(month)}` : "/api/finance"),
  searchIdeas: async (q: string) =>
    (await json("GET", `/api/ideas/search?q=${encodeURIComponent(q)}`)).ideas as FoundIdea[],

  // ===== Treino (worker/routes/workout.ts) =====
  /** Semana de treino: plano, status dos dias, treino de hoje, sessão aberta, sequência e brasão. */
  workoutWeek: () => request<WorkoutWeekView>("GET", "/api/workout"),
  createWorkoutTemplate: async (input: WorkoutTemplateCreate) =>
    (await json("POST", "/api/workout/templates", input)).template as WorkoutTemplate,
  updateWorkoutTemplate: async (id: string, patch: WorkoutTemplatePatch) =>
    (await json("PATCH", tpl(id), patch)).template as WorkoutTemplate,
  /** Os dias que apontavam para ele viram folga. */
  deleteWorkoutTemplate: async (id: string) => {
    await json("DELETE", tpl(id));
  },
  /** 409 com `fields.name` se o treino já tem esse exercício. */
  createWorkoutExercise: async (templateId: string, input: WorkoutExerciseCreate) =>
    (await json("POST", `${tpl(templateId)}/exercises`, input)).exercise as WorkoutExercise,
  updateWorkoutExercise: async (templateId: string, id: string, patch: WorkoutExercisePatch) =>
    (await json("PATCH", `${tpl(templateId)}/exercises/${enc(id)}`, patch)).exercise as WorkoutExercise,
  deleteWorkoutExercise: async (templateId: string, id: string) => {
    await json("DELETE", `${tpl(templateId)}/exercises/${enc(id)}`);
  },
  /** `ids` = todos os exercícios do treino, na nova ordem. */
  reorderWorkoutExercises: async (templateId: string, ids: string[]) =>
    (await json("PATCH", `${tpl(templateId)}/exercises/order`, { ids })).template as WorkoutTemplate,
  saveWorkoutPlan: (input: WorkoutPlanPut) =>
    request<{ plan: WorkoutPlanDay[]; settings: WorkoutSettings }>("PUT", "/api/workout/plan", input),
  updateWorkoutSettings: async (patch: WorkoutSettingsPatch) =>
    (await json("PATCH", "/api/workout/settings", patch)).settings as WorkoutSettings,
  /** Abre o treino ao vivo (201). 409 se já houver um em andamento. */
  startWorkoutSession: async (templateId: string) =>
    (await json("POST", "/api/workout/sessions", { templateId })).session as SessionView,
  workoutSession: async (id: string) => (await json("GET", sess(id))).session as SessionView,
  /** Descarta a sessão (e as séries dela). */
  discardWorkoutSession: async (id: string) => {
    await json("DELETE", sess(id));
  },
  finishWorkoutSession: async (id: string) => (await json("POST", `${sess(id)}/finish`)).summary as SessionSummary,
  /** Grava uma série; repetir o mesmo exercício+série substitui. */
  logWorkoutSet: (sessionId: string, input: WorkoutSetCreate) => request<SetResult>("POST", `${sess(sessionId)}/sets`, input),
  updateWorkoutSet: (sessionId: string, setId: string, patch: WorkoutSetPatch) =>
    request<SetResult>("PATCH", `${sess(sessionId)}/sets/${enc(setId)}`, patch),
  deleteWorkoutSet: (sessionId: string, setId: string) =>
    request<{ id: string; sessionXp: number }>("DELETE", `${sess(sessionId)}/sets/${enc(setId)}`),
  /** Relatório semana × semana (week = qualquer dia da semana; sem ela, a semana atual). */
  workoutReport: (week?: string) =>
    request<WorkoutReportResponse>("GET", week ? `/api/workout/report?week=${enc(week)}` : "/api/workout/report"),

  // ===== Missões diárias (worker/routes/missions.ts) =====
  /** Missões valendo no dia, com feito/sequência, dia cumprido e os 7 pontinhos da semana. */
  missions: (date: string) => request<MissionsDayView>("GET", `/api/missions?date=${enc(date)}`),
  /** 409 acima de 8 ativas. */
  createMission: async (input: MissionCreate) => (await json("POST", "/api/missions", input)).mission as Mission,
  /** XP e atributo dão 409 depois da primeira marcação. */
  updateMission: async (id: string, patch: MissionPatch) =>
    (await json("PATCH", `/api/missions/${enc(id)}`, patch)).mission as Mission,
  /** `ids` = todas as missões ativas, na nova ordem. */
  reorderMissions: (ids: string[]) => request<MissionsDayView>("PATCH", "/api/missions/order", { ids }),
  /** Arquiva (some a partir de hoje); sem marcações e criada hoje, apaga de verdade (`deleted`). */
  archiveMission: (id: string) => request<{ id: string; deleted: boolean }>("DELETE", `/api/missions/${enc(id)}`),
  /** Desfaz o arquivamento feito hoje. */
  restoreMission: async (id: string) => (await json("POST", `/api/missions/${enc(id)}/restore`)).mission as Mission,
  /** Marca ou desmarca a missão no dia (a interface só usa hoje). */
  checkMission: (id: string, date: string, done: boolean) =>
    request<MissionCheckResult>("PUT", `/api/missions/${enc(id)}/checks/${enc(date)}`, { done }),
};
