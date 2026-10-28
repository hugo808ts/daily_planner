import { useEffect, useState } from "react";
import { todayISO } from "../../shared/dates";
import type { Folder, Idea, Task } from "../../shared/types";
import { ConfirmSheet, type SavedItem } from "../components/ConfirmSheet";
import { FolderGrid } from "../components/FolderGrid";
import { IdeaEditor } from "../components/IdeaEditor";
import { IdeaList } from "../components/IdeaList";
import { showToast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { useNow } from "../lib/useNow";
import { useFolderIdeas, useFolders } from "../lib/useIdeas";

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

interface Props {
  /** Ideia guardada pela captura rápida, para aparecer sem recarregar. */
  captured?: Idea | null;
  /** Tarefa criada por "Virar tarefa". */
  onTaskSaved?: (task: Task) => void;
}

/** Sessão aberta do editor; `key` não muda quando uma ideia nova é criada (o foco fica onde está). */
type Editing = { key: string; idea: Idea | null };

/**
 * Ideias. No celular, uma tela por vez (pastas → lista → editor), escolhida pelo estado
 * `folderId` / `editing`; no computador as três podem ficar lado a lado com o mesmo estado.
 */
export function Ideas({ captured, onTaskSaved }: Props) {
  const now = useNow(60_000);
  const { folders, error: foldersError, reload: reloadFolders, setFolders } = useFolders();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [query, setQuery] = useState("");
  const [converting, setConverting] = useState<Idea | null>(null);
  const { ideas, error: ideasError, reload: reloadIdeas, upsert, remove } = useFolderIdeas(folderId);

  const folder = folders?.find((f) => f.id === folderId) ?? null;
  const view = editing ? "editor" : folderId ? "list" : "folders";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Pasta apagada (em outro aparelho, por exemplo): volta para a lista de pastas.
  useEffect(() => {
    if (folders && folderId && !folders.some((f) => f.id === folderId)) {
      setFolderId(null);
      setEditing(null);
    }
  }, [folders, folderId]);

  useEffect(() => {
    if (!captured) return;
    upsert(captured);
    void reloadFolders(); // a captura pode ter criado uma pasta
  }, [captured, upsert, reloadFolders]);

  const bumpCount = (id: string, delta: number) =>
    setFolders((list) => list?.map((f) => (f.id === id ? { ...f, openCount: Math.max(0, f.openCount + delta) } : f)) ?? list);

  const openIdea = (idea: Idea) => {
    setFolderId(idea.folderId);
    setEditing({ key: idea.id, idea });
  };

  const onIdeaSaved = (idea: Idea, created: boolean) => {
    upsert(idea);
    if (created) bumpCount(idea.folderId, 1);
    setEditing((e) => (e && (e.idea === null || e.idea.id === idea.id) ? { ...e, idea } : e));
  };

  const restore = async (deleted: Idea) => {
    try {
      upsert(await api.restoreIdea(deleted));
      bumpCount(deleted.folderId, 1);
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const onResolved = (deleted: Idea) => {
    remove(deleted.id);
    bumpCount(deleted.folderId, -1);
    setEditing(null);
    showToast("Ideia apagada", { label: "Desfazer", onClick: () => void restore(deleted) });
  };

  const togglePin = async (idea: Idea) => {
    upsert({ ...idea, pinned: !idea.pinned });
    try {
      upsert(await api.updateIdea(idea.id, { pinned: !idea.pinned }));
    } catch (e) {
      upsert(idea);
      showToast(errorMessage(e));
    }
  };

  const onConverted = (item: SavedItem) => {
    setConverting(null);
    if (item.kind === "task") {
      onTaskSaved?.(item.task);
      showToast("Tarefa salva");
    } else {
      // Na folha dá para trocar o tipo; aí vira outra ideia.
      upsert(item.idea);
      void reloadFolders();
      showToast("Ideia guardada");
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-md px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 5.5rem)",
      }}
    >
      {view === "editor" && editing && folderId ? (
        <IdeaEditor
          key={editing.key}
          folderId={folderId}
          folderName={folder?.name ?? "Ideias"}
          idea={editing.idea}
          onBack={() => setEditing(null)}
          onSaved={onIdeaSaved}
          onResolved={onResolved}
          onTurnIntoTask={setConverting}
        />
      ) : view === "list" && folderId ? (
        folder ? (
          <IdeaList
            folder={folder}
            ideas={ideas}
            error={ideasError}
            now={now}
            onReload={() => void reloadIdeas()}
            onBack={() => setFolderId(null)}
            onOpen={openIdea}
            onNew={() => setEditing({ key: `new-${Date.now()}`, idea: null })}
            onTogglePin={(i) => void togglePin(i)}
          />
        ) : (
          <div aria-busy="true" aria-label="Carregando" className="h-40" />
        )
      ) : (
        <FolderGrid
          folders={folders}
          error={foldersError}
          query={query}
          onQuery={setQuery}
          onReload={() => void reloadFolders()}
          onOpenFolder={(f) => setFolderId(f.id)}
          onOpenIdea={openIdea}
          onFolderSaved={(f) =>
            setFolders((list) => [...(list ?? []).filter((x) => x.id !== f.id), f].sort(byName))
          }
          onFolderDeleted={(id) => {
            setFolders((list) => list?.filter((f) => f.id !== id) ?? list);
            if (folderId === id) setFolderId(null);
          }}
        />
      )}

      {converting && (
        <ConfirmSheet
          initial={{
            kind: "task",
            title: converting.title,
            date: todayISO(),
            time: null,
            area: null,
            folderId: null,
            source: "rules",
          }}
          onClose={() => setConverting(null)}
          onSaved={onConverted}
        />
      )}
    </div>
  );
}
