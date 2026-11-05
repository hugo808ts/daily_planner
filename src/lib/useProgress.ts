import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Progress } from "./api";

const CHANGED = "agenda:progress-changed";

/** Avisa quem usa useProgress com `listen` (ex.: botão da barra do computador) que o XP mudou. */
export const notifyProgressChanged = () => window.dispatchEvent(new Event(CHANGED));

/** Nível e medalha da semana que começa em `start`; `refresh` devolve o dado novo (ou null se falhar). */
export function useProgress(start: string, listen = false) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const current = useRef(start);
  current.current = start;

  const refresh = useCallback(async (): Promise<Progress | null> => {
    const requested = start;
    try {
      const p = await api.progress(requested);
      if (current.current !== requested) return null;
      setProgress(p);
      return p;
    } catch {
      return null; // o placar de XP é um extra: falhar em silêncio
    }
  }, [start]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onChanged = () => void refresh();
    if (listen) window.addEventListener(CHANGED, onChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CHANGED, onChanged);
    };
  }, [refresh, listen]);

  return { progress, refresh };
}
