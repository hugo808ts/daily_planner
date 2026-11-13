import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkoutWeekView } from "../../shared/workout";
import { api, ApiError } from "./api";

/**
 * Semana de treino (GET /api/workout). Os dados antigos ficam na tela enquanto recarrega.
 * Recarrega quando o app volta a ficar visível (ex.: treinou em outro aparelho).
 */
export function useWorkout() {
  const [data, setData] = useState<WorkoutWeekView | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Só a resposta do pedido mais recente vale (recargas seguidas não se atropelam). */
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await api.workoutWeek();
      if (seq.current !== mine) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (seq.current !== mine) return;
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar o treino.");
    }
  }, []);

  useEffect(() => {
    void reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  return { data, error, reload };
}
