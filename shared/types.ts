export type Area = "work" | "school" | "personal";

export interface Task {
  id: string;
  title: string;
  date: string;
  time: string | null;
  area: Area | null;
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
  source: "ai" | "rules";
}

export interface WeekReport {
  start: string;
  end: string;
  done: number;
  notDone: number;
  percent: number;
  perDay: { date: string; done: number; notDone: number }[];
  notDoneTasks: Task[];
}
