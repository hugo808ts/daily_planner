import { useEffect, useState } from "react";
import { todayISO } from "../../shared/dates";
import type { Folder, Idea, Task } from "../../shared/types";
import { ConfirmSheet, type SavedItem } from "../components/ConfirmSheet";
import { FolderGrid } from "../components/FolderGrid";
import { IdeaEditor } from "../components/IdeaEditor";
import { IdeaList, RecentIdeas } from "../components/IdeaList";
import { showToast } from "../components/Toast";
import { LightbulbIcon } from "../components/ui/Icon";
import { api, ApiError } from "../lib/api";
import { useNow } from "../lib/useNow";
import { sortIdeas, useFolderIdeas, useFolders } from "../lib/useIdeas";

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

const RECENT_MAX = 12;

function EmptyPane({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <LightbulbIcon size={24} />
        </span>
        <h2 className="mt-3 font-display text-lg font-semibold">{title}</h2>
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

  // Computador, sem pasta aberta: "Recentes" = últimas ideias de todas as pastas, fixadas primeiro.
  const [recent, setRecent] = useState<Idea[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentTick, setRecentTick] = useState(0);
  useEffect(() => {
    if (!wide || folderId || !folders) return;
    let alive = true;
    Promise.all(folders.map((f) => api.ideas(f.id)))
      .then((lists) => {
        if (!alive) return;
        setRecent(sortIdeas(lists.flat()).slice(0, RECENT_MAX));
        setRecentError(null);
      })
      .catch((e) => alive && setRecentError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [wide, folderId, folders, captured, recentTick]);
  const patchRecent = (idea: Idea) =>
    setRecent((list) => (list ? sortIdeas(list.map((i) => (i.id === idea.id ? idea : i))) : list));

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
    patchRecent({ ...idea, pinned: !idea.pinned });
    try {
      const updated = await api.updateIdea(idea.id, { pinned: !idea.pinned });
      upsert(updated);
      patchRecent(updated);
    } catch (e) {
      upsert(idea);
      patchRecent(idea);
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
      recentSelected={wide && !folderId}
      onOpenRecent={() => {
        setFolderId(null);
        setEditing(null);
      }}
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
    const showRecent = !folderId;
    // Pasta para a "Nova ideia" dos Recentes: a da ideia mais recente, ou a primeira.
    const newTarget = recent?.[0]?.folderId ?? folders?.[0]?.id ?? null;
    return (
      <div className={`grid h-full bg-bg ${showRecent ? "grid-cols-[260px_minmax(0,1fr)]" : "grid-cols-[240px_300px_minmax(0,1fr)]"}`}>
        <nav data-testid="folders-pane" aria-label="Pastas e busca" className="pane border-r border-line bg-bg px-3 pt-[18px] pb-6">
          {grid}
        </nav>
        {showRecent ? (
          <div data-testid="list-pane" className="pane bg-bg px-8 pt-[22px] pb-8">
            <div className="mx-auto max-w-[900px]">
              <RecentIdeas
                ideas={recent}
                error={recentError}
                folders={folders ?? []}
                now={now}
                onReload={() => setRecentTick((n) => n + 1)}
                onOpen={openIdea}
                onTogglePin={(i) => void togglePin(i)}
                onNew={
                  newTarget
                    ? () => {
                        setFolderId(newTarget);
                        setEditing({ key: `new-${Date.now()}`, idea: null });
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div data-testid="list-pane" className="pane border-r border-line bg-bg px-3 pt-[18px] pb-6">
              {folder ? list(folder) : <div role="status" aria-label="Carregando" className="h-40" />}
            </div>
            <div data-testid="editor-pane" className="pane bg-bg px-10 pt-7 pb-10">
              {editing ? (
                <div className="mx-auto max-w-[680px]">{editor(folderId, editing)}</div>
              ) : (
                <EmptyPane title="Escolha uma ideia" text="Ou crie uma nova com Nova ideia, na lista. Tudo salva sozinho." />
              )}
            </div>
          </>
        )}
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
          <div role="status" aria-label="Carregando" className="h-40" />
        )
      ) : (
        grid
      )}

      {sheet}
    </div>
  );
}
