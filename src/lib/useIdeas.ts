import { useCallback, useEffect, useRef, useState } from "react";
import type { Folder, Idea } from "../../shared/types";
import { api, ApiError } from "./api";

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Mesma ordem do servidor: fixadas primeiro, depois a mais recente. */
export function sortIdeas(ideas: Idea[]): Idea[] {
  return [...ideas].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** Recarrega quando o app volta para a frente (outro aparelho pode ter mudado algo). */
function useOnVisible(reload: () => void) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setFolders(await api.folders());
      setError(null);
    } catch (e) {
      setError(message(e, "Não foi possível carregar as pastas."));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  useOnVisible(reload);

  return { folders, error, reload, setFolders };
}

/** Ideias de uma pasta, com alterações locais já ordenadas. */
export function useFolderIdeas(folderId: string | null) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(folderId);
  current.current = folderId;

  const reload = useCallback(async () => {
    const requested = folderId;
    if (!requested) return;
    try {
      const list = await api.ideas(requested);
      if (current.current !== requested) return;
      setIdeas(list);
      setError(null);
    } catch (e) {
      if (current.current !== requested) return;
      setError(message(e, "Não foi possível carregar as ideias."));
    }
  }, [folderId]);

  useEffect(() => {
    setIdeas(null);
    setError(null);
    void reload();
  }, [reload]);
  useOnVisible(reload);

  /** Insere ou atualiza; tira da lista se a ideia não é (mais) desta pasta. */
  const upsert = useCallback((idea: Idea) => {
    setIdeas((list) => {
      if (!list) return list;
      const others = list.filter((i) => i.id !== idea.id);
      return idea.folderId === current.current ? sortIdeas([...others, idea]) : others;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setIdeas((list) => (list ? list.filter((i) => i.id !== id) : list));
  }, []);

  return { ideas, error, reload, upsert, remove };
}
