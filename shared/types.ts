import type { Difficulty, MedalTier } from "./xp";

export type Area = "work" | "school" | "personal";

export interface Task {
  id: string;
  title: string;
  date: string;
  time: string | null;
  area: Area | null;
  difficulty: Difficulty;
  doneAt: string | null;
  movedFromId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayNote {
  date: string;
  text: string;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string | null;
  createdAt: string;
  openCount: number;
}

export interface Idea {
  id: string;
  folderId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkTitle: string | null;
  linkThumb: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureResult {
  kind: "task" | "idea";
  title: string;
  date: string | null;
  time: string | null;
  area: Area | null;
  folderId: string | null;
  difficulty: Difficulty;
  source: "ai" | "rules";
}

/** Tarefa não feita do resumo; movedTo = já existe uma cópia em outro dia. */
export type ReportTask = Task & { movedTo?: boolean };

export interface WeekReport {
  start: string;
  end: string;
  done: number;
  notDone: number;
  /** null quando não há tarefas contadas (nada a dividir). */
  percent: number | null;
  perDay: { date: string; done: number; notDone: number }[];
  notDoneTasks: ReportTask[];
  /** XP das tarefas feitas de segunda a sábado. */
  xp: number;
  /** null com 0 XP. */
  medal: MedalTier | null;
  /** Tarefas feitas (seg–sáb) por dificuldade. */
  byDifficulty: Record<Difficulty, number>;
  /** Dia (seg–sáb) com mais XP; o primeiro em caso de empate; null com 0 XP. */
  bestDay: string | null;
}
