import { useCallback, useEffect, useRef, useState } from "react";
import type { DayNote, Task } from "../../shared/types";
import { api, ApiError, type WeekData } from "./api";

/** Mesma ordem do servidor: data, horário (sem horário por último), criação. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function useWeek(start: string) {
  const [data, setData] = useState<WeekData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(start);
  current.current = start;

  const reload = useCallback(async () => {
    const requested = start;
    try {
      const week = await api.week(requested);
      if (current.current !== requested) return;
      setData(week);
      setError(null);
    } catch (e) {
      if (current.current !== requested) return;
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar a semana.");
    }
  }, [start]);

  useEffect(() => {
    setData((d) => (d && d.start === start ? d : null));
    void reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [start, reload]);

  /** Insere ou atualiza; tira da semana se a data saiu dela. */
  const setTask = useCallback((task: Task) => {
    setData((d) => {
      if (!d) return d;
      const others = d.tasks.filter((t) => t.id !== task.id);
      const inWeek = d.days.includes(task.date);
      return { ...d, tasks: inWeek ? sortTasks([...others, task]) : others };
    });
  }, []);

  const removeTask = useCallback((id: string) => {
    setData((d) => (d ? { ...d, tasks: d.tasks.filter((t) => t.id !== id) } : d));
  }, []);

  const setNote = useCallback((date: string, note: DayNote | null) => {
    setData((d) => {
      if (!d) return d;
      const others = d.notes.filter((n) => n.date !== date);
      return { ...d, notes: note ? [...others, note] : others };
    });
  }, []);

  return { data, error, reload, setTask, removeTask, setNote };
}
