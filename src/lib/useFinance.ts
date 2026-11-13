import { useCallback, useEffect, useRef, useState } from "react";
import type { FinanceResponse } from "../../shared/finance";
import { api, ApiError } from "./api";

/**
 * Painel financeiro do mês pedido (AAAA-MM; null = mês atual do servidor).
 * Ao trocar de mês, os dados do mês anterior ficam na tela até o novo chegar.
 * Recarrega quando o app volta a ficar visível (o agente pode ter sincronizado).
 */
export function useFinance(month: string | null) {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(month);
  current.current = month;

  const reload = useCallback(async () => {
    const requested = month;
    try {
      const res = await api.finance(requested ?? undefined);
      if (current.current !== requested) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (current.current !== requested) return;
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar o financeiro.");
    }
  }, [month]);

  useEffect(() => {
    void reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [month, reload]);

  return { data, error, reload };
}
