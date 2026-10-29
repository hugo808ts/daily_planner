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
  /** Computador: pastas | lista | editor lado a lado, cada coluna com rolagem própria. */
  wide?: boolean;
}

const MOBILE_PAD = {
  paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 5.5rem)",
};

function EmptyPane({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <p aria-hidden className="text-3xl opacity-70">
          {icon}
        </p>
        <p className="mt-2 font-display text-lg font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-[32ch] text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

/** Sessão aberta do editor; `key` não muda quando uma ideia nova é criada (o foco fica onde está). */
type Editing = { key: string; idea: Idea | null };

/**
 * Ideias. No celular, uma tela por vez (pastas → lista → editor), escolhida pelo estado
 * `folderId` / `editing`; no computador as três podem ficar lado a lado com o mesmo estado.
 */
export function Ideas({ captured, onTaskSaved, wide = false }: Props) {
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
    if (!wide) window.scrollTo(0, 0);
  }, [view, wide]);

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

  const editor = (fid: string, ed: Editing) => (
    <IdeaEditor
      key={ed.key}
      folderId={fid}
      folderName={folder?.name ?? "Ideias"}
      idea={ed.idea}
      wide={wide}
      onBack={wide ? undefined : () => setEditing(null)}
      onSaved={onIdeaSaved}
      onResolved={onResolved}
      onTurnIntoTask={setConverting}
    />
  );

  const list = (f: Folder) => (
    <IdeaList
      folder={f}
      ideas={ideas}
      error={ideasError}
      now={now}
      wide={wide}
      selectedId={wide ? (editing?.idea?.id ?? null) : null}
      onReload={() => void reloadIdeas()}
      onBack={wide ? undefined : () => setFolderId(null)}
      onOpen={openIdea}
      onNew={() => setEditing({ key: `new-${Date.now()}`, idea: null })}
      onTogglePin={(i) => void togglePin(i)}
    />
  );

  const grid = (
    <FolderGrid
      folders={folders}
      error={foldersError}
      query={query}
      sidebar={wide}
      selectedId={wide ? folderId : null}
      onQuery={setQuery}
      onReload={() => void reloadFolders()}
      onOpenFolder={(f) => {
        setFolderId(f.id);
        setEditing(null);
      }}
      onOpenIdea={openIdea}
      onFolderSaved={(f) => setFolders((list) => [...(list ?? []).filter((x) => x.id !== f.id), f].sort(byName))}
      onFolderDeleted={(id) => {
        setFolders((list) => list?.filter((f) => f.id !== id) ?? list);
        if (folderId === id) setFolderId(null);
      }}
    />
  );

  const sheet = converting && (
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
  );

  if (wide) {
    return (
      <div className="grid h-dvh grid-cols-[240px_300px_minmax(0,1fr)]">
        <div data-testid="folders-pane" className="pane border-r border-line bg-ink/[0.025] px-3 pt-[18px] pb-6">
          {grid}
        </div>
        <div data-testid="list-pane" className="pane border-r border-line px-3 pt-[18px] pb-6">
          {folderId && folder ? (
            list(folder)
          ) : (
            <EmptyPane icon="🗂" title="Escolha uma pasta" text="As ideias da pasta aparecem aqui, as fixadas primeiro." />
          )}
        </div>
        <div data-testid="editor-pane" className="pane bg-surface px-10 pt-7 pb-10">
          {editing && folderId ? (
            <div className="mx-auto max-w-[680px]">{editor(folderId, editing)}</div>
          ) : (
            <EmptyPane
              icon="✍️"
              title="Escolha uma ideia"
              text={folder ? "Ou crie uma nova com o + da lista. Tudo salva sozinho." : "Abra uma pasta à esquerda para ver e escrever ideias."}
            />
          )}
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4" style={MOBILE_PAD}>
      {view === "editor" && editing && folderId ? (
        editor(folderId, editing)
      ) : view === "list" && folderId ? (
        folder ? (
          list(folder)
        ) : (
          <div aria-busy="true" aria-label="Carregando" className="h-40" />
        )
      ) : (
        grid
      )}

      {sheet}
    </div>
  );
}
