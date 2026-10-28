import type { Area, DayNote, Task } from "../../shared/types";

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

export interface MoveResult {
  task: Task;
  copied: boolean;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
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
};
