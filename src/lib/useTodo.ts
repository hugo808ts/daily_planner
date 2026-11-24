import { useCallback, useEffect, useRef, useState } from "react";
import { todayISO } from "../../shared/dates";
import type { Task, TodoView } from "../../shared/types";
import { api, ApiError } from "./api";
import { sortTasks } from "./useWeek";

/** A tarefa entra na lista A fazer de `date`? (sem data pendente ou feita nesse dia; ou compromisso do dia) */
function where(task: Task, date: string): "undated" | "appointments" | null {
  if (task.date === date) return "appointments";
  if (task.date !== null) return null;
  if (!task.doneAt || todayISO(new Date(task.doneAt)) === date) return "undated";
  return null;
}

/** Pendentes primeiro (mais antigas no topo), depois as feitas hoje na ordem em que foram marcadas. */
const byList = (a: Task, b: Task) =>
  Number(!!a.doneAt) - Number(!!b.doneAt) ||
  (a.doneAt ?? "").localeCompare(b.doneAt ?? "") ||
  a.createdAt.localeCompare(b.createdAt);

/** Lista "A fazer" do dia (GET /api/todo). Recarrega quando o app volta a ficar visível. */
export function useTodo(date: string) {
  const [data, setData] = useState<TodoView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await api.todo(date);
      if (seq.current !== mine) return;
      setData({ ...res, appointments: sortTasks(res.appointments) });
      setError(null);
    } catch (e) {
      if (seq.current !== mine) return;
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar a lista.");
    }
  }, [date]);

  useEffect(() => {
    void reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  /** Insere, atualiza ou tira da lista conforme a data e o feito. */
  const setTask = useCallback(
    (task: Task) => {
      seq.current++;
      setData((d) => {
        if (!d) return d;
        const undated = d.undated.filter((t) => t.id !== task.id);
        const appointments = d.appointments.filter((t) => t.id !== task.id);
        const w = where(task, date);
        if (w === "undated") undated.push(task);
        if (w === "appointments") appointments.push(task);
        return { ...d, undated: undated.sort(byList), appointments: sortTasks(appointments) };
      });
    },
    [date],
  );

  const removeTask = useCallback((id: string) => {
    seq.current++;
    setData((d) =>
      d ? { ...d, undated: d.undated.filter((t) => t.id !== id), appointments: d.appointments.filter((t) => t.id !== id) } : d,
    );
  }, []);

  return { data, error, reload, setTask, removeTask };
}
