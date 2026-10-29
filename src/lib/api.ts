import type { Area, CaptureResult, DayNote, Folder, Idea, Task, WeekReport } from "../../shared/types";

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
  date: string;
  time?: string | null;
  area?: Area | null;
}

export interface TaskPatch {
  title?: string;
  date?: string;
  time?: string | null;
  area?: Area | null;
  done?: boolean;
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
    });
  } catch {
    throw new ApiError("Sem conexão. Verifique a internet e tente de novo.", 0);
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

const json = (method: string, path: string, body?: unknown) => request<Record<string, unknown>>(method, path, body);

export const api = {
  week: (start: string) => request<WeekData>("GET", `/api/week?start=${encodeURIComponent(start)}`),
  report: async (start: string) =>
    (await json("GET", `/api/report?start=${encodeURIComponent(start)}`)).report as WeekReport,
  createTask: async (input: NewTask) => (await json("POST", "/api/tasks", input)).task as Task,
  updateTask: async (id: string, patch: TaskPatch) =>
    (await json("PATCH", `/api/tasks/${encodeURIComponent(id)}`, patch)).task as Task,
  deleteTask: async (id: string) => {
    await json("DELETE", `/api/tasks/${encodeURIComponent(id)}`);
  },
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
  searchIdeas: async (q: string) =>
    (await json("GET", `/api/ideas/search?q=${encodeURIComponent(q)}`)).ideas as FoundIdea[],
};
