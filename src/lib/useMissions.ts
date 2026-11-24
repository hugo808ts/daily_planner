import { useCallback, useEffect, useRef, useState } from "react";
import type { MissionsDayView } from "../../shared/hero";
import { api, ApiError } from "./api";

/**
 * Missões do dia (GET /api/missions?date=). Os dados antigos ficam na tela enquanto recarrega.
 * Recarrega quando o app volta a ficar visível (ex.: marcou no outro aparelho).
 */
export function useMissions(date: string) {
  const [data, setData] = useState<MissionsDayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Só a resposta do pedido mais recente vale (recargas seguidas não se atropelam). */
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await api.missions(date);
      if (seq.current !== mine) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (seq.current !== mine) return;
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar as missões.");
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

  /** Troca o dado na hora (toque otimista); a próxima recarga confirma. */
  const patch = useCallback((fn: (d: MissionsDayView) => MissionsDayView) => {
    seq.current++; // uma recarga em voo não desfaz o toque
    setData((d) => (d ? fn(d) : d));
  }, []);

  return { data, error, reload, patch };
}
