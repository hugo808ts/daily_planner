import { useEffect, useRef, useState } from "react";
import { FOLDER_NAME_MAX } from "../../shared/limits";
import type { Folder } from "../../shared/types";
import { api, ApiError, type FoundIdea } from "../lib/api";
import { plural } from "../lib/format";
import { AskSheet } from "./AskSheet";
import { showToast } from "./Toast";

const SEARCH_DEBOUNCE_MS = 250;

const FIELD =
  "block w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink focus:border-accent focus:outline-none aria-invalid:border-danger";

/** Fundo do ícone da pasta: um tom estável por pasta, misturado com a superfície (claro e escuro). */
export function folderTint(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `color-mix(in srgb, hsl(${h} 75% 62%) 20%, var(--surface))`;
}

export const ideaCount = (n: number) => plural(n, "ideia", "ideias");

interface Props {
  folders: Folder[] | null;
  error: string | null;
  query: string;
  onQuery: (q: string) => void;
  onReload: () => void;
  onOpenFolder: (folder: Folder) => void;
  onOpenIdea: (idea: FoundIdea) => void;
  onFolderSaved: (folder: Folder) => void;
  onFolderDeleted: (id: string) => void;
}

/** Tela inicial das Ideias: busca em todas as pastas e a grade de pastas. */
export function FolderGrid(props: Props) {
  const { folders, error, query, onQuery, onReload, onOpenFolder } = props;
  const [sheet, setSheet] = useState<{ folder: Folder | null } | null>(null);
  const searching = query.trim().length > 0;

  return (
    <section aria-labelledby="ideas-title">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h1 id="ideas-title" className="font-display text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Ideias
        </h1>
        <button
          type="button"
          aria-label="Nova pasta"
          onClick={() => setSheet({ folder: null })}
          className="grid size-11 place-items-center rounded-2xl bg-ink text-bg active:opacity-85"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="relative mb-4">
        <label htmlFor="ideas-search" className="sr-only">
          Buscar em todas as ideias
        </label>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden>
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
        <input
          id="ideas-search"
          type="search"
          value={query}
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Buscar em todas as ideias"
          onChange={(e) => onQuery(e.target.value)}
          className="block min-h-11 w-full rounded-2xl bg-surface py-2.5 pr-3 pl-10 text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
      </div>

      {searching ? (
        <SearchResults query={query.trim()} folders={folders ?? []} onOpen={props.onOpenIdea} />
      ) : error && !folders ? (
        <div role="alert" className="rounded-[20px] bg-surface px-4 py-5 text-center text-sm">
          <p className="mb-2 text-danger-ink">{error}</p>
          <button type="button" onClick={onReload} className="rounded-xl bg-accent/10 px-4 font-semibold text-accent active:bg-accent/20">
            Tentar de novo
          </button>
        </div>
      ) : !folders ? (
        <div aria-busy="true" aria-label="Carregando" className="grid grid-cols-2 gap-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-[104px] rounded-[20px] bg-surface motion-safe:animate-pulse" />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-5 py-7 text-center">
          <p aria-hidden className="text-3xl">🗂</p>
          <h2 className="mt-2 font-display text-xl font-semibold">Crie sua primeira pasta</h2>
          <p className="mx-auto mt-1 max-w-[30ch] text-sm text-muted">
            Toda ideia mora numa pasta: estudos, vídeos para ver, projetos… Você escolhe os nomes.
          </p>
          <button
            type="button"
            onClick={() => setSheet({ folder: null })}
            className="mt-4 rounded-2xl bg-accent px-5 font-semibold text-white active:opacity-85"
          >
            Nova pasta
          </button>
        </div>
      ) : (
        <ul aria-label="Pastas" className="grid grid-cols-2 gap-2.5">
          {folders.map((f) => (
            <li key={f.id} className="relative">
              <button
                type="button"
                aria-label={`Abrir pasta ${f.name}, ${ideaCount(f.openCount)}`}
                onClick={() => onOpenFolder(f)}
                className="flex min-h-[104px] w-full flex-col justify-between rounded-[20px] bg-surface p-3 text-left transition-transform duration-150 active:scale-[0.98]"
              >
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-xl text-lg"
                  style={{ background: folderTint(f.id) }}
                >
                  {f.emoji || "🗂"}
                </span>
                <span className="mt-2 block min-w-0">
                  <b className="block truncate pr-1 text-[15px] font-semibold">{f.name}</b>
                  <small className="text-xs text-muted">{ideaCount(f.openCount)}</small>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Editar pasta ${f.name}`}
                onClick={() => setSheet({ folder: f })}
                className="absolute top-1 right-1 grid place-items-center rounded-xl text-muted active:bg-ink/5"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                  <path d="M6 12h.01M12 12h.01M18 12h.01" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setSheet({ folder: null })}
              className="grid min-h-[104px] w-full place-items-center rounded-[20px] border-[1.5px] border-dashed border-dot text-sm text-muted active:bg-ink/5"
            >
              + Nova pasta
            </button>
          </li>
        </ul>
      )}

      {sheet && (
        <FolderSheet
          folder={sheet.folder}
          onClose={() => setSheet(null)}
          onSaved={(f) => {
            setSheet(null);
            props.onFolderSaved(f);
          }}
          onDeleted={(id) => {
            setSheet(null);
            props.onFolderDeleted(id);
          }}
        />
      )}
    </section>
  );
}

function SearchResults({ query, folders, onOpen }: { query: string; folders: Folder[]; onOpen: (idea: FoundIdea) => void }) {
  const [results, setResults] = useState<{ q: string; ideas: FoundIdea[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api
        .searchIdeas(query)
        .then((ideas) => {
          if (!alive) return;
          setResults({ q: query, ideas });
          setError(null);
        })
        .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Não foi possível buscar."));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  if (error) return <p role="alert" className="px-1 text-sm text-danger-ink">{error}</p>;
  if (!results) return <p className="px-1 text-sm text-muted">Buscando…</p>;
  if (results.ideas.length === 0)
    return <p className="px-1 text-sm text-muted">Nada encontrado para “{results.q}”.</p>;

  return (
    <ul aria-label="Resultados da busca" className="space-y-2">
      {results.ideas.map((idea) => {
        const emoji = folders.find((f) => f.id === idea.folderId)?.emoji || "🗂";
        return (
          <li key={idea.id}>
            <button
              type="button"
              onClick={() => onOpen(idea)}
              className="block w-full rounded-2xl bg-surface px-4 py-3 text-left active:bg-surface/70"
            >
              <span className="mb-1 inline-flex items-center gap-1 rounded-lg bg-bg px-2 py-0.5 text-xs font-medium text-muted">
                <span aria-hidden>{emoji}</span>
                {idea.folderName}
              </span>
              <b className="block font-semibold">{idea.title}</b>
              {idea.body && <span className="mt-0.5 line-clamp-2 text-sm text-muted">{idea.body}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface SheetProps {
  folder: Folder | null;
  onClose: () => void;
  onSaved: (folder: Folder) => void;
  onDeleted: (id: string) => void;
}

/** Criar ou editar uma pasta (nome + emoji); editar também permite apagar. */
function FolderSheet({ folder, onClose, onSaved, onDeleted }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(folder?.name ?? "");
  const [emoji, setEmoji] = useState(folder?.emoji ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const title = folder ? "Editar pasta" : "Nova pasta";

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const save = async () => {
    if (!name.trim()) {
      setError("Dê um nome à pasta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = { name, emoji: emoji.trim() || null };
      onSaved(folder ? await api.updateFolder(folder.id, input) : await api.createFolder(input));
    } catch (e) {
      setError(e instanceof ApiError ? (e.fields?.name ?? e.fields?.emoji ?? e.message) : "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!folder) return;
    try {
      await api.deleteFolder(folder.id);
      onDeleted(folder.id);
    } catch (e) {
      setAsking(false);
      showToast(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    }
  };

  const n = folder?.openCount ?? 0;
  const question =
    n === 0 ? "Apagar esta pasta?" : n === 1 ? "Apagar a pasta e a 1 ideia dentro?" : `Apagar a pasta e as ${n} ideias dentro?`;

  return (
    <dialog
      ref={dialog}
      className="sheet-dialog"
      aria-labelledby="folder-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="px-5 pt-2.5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
        <h2 id="folder-sheet-title" className="mb-3 font-display text-xl font-semibold">
          {title}
        </h2>
        <div className="flex gap-2">
          <div className="w-20 shrink-0">
            <label htmlFor="folder-emoji" className="sr-only">
              Emoji (opcional)
            </label>
            <input
              id="folder-emoji"
              value={emoji}
              maxLength={8}
              placeholder="🗂"
              onChange={(e) => setEmoji(e.target.value)}
              className={`${FIELD} text-center`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="folder-name" className="sr-only">
              Nome da pasta
            </label>
            <input
              id="folder-name"
              value={name}
              maxLength={FOLDER_NAME_MAX}
              placeholder="Nome da pasta, ex.: Estudos"
              enterKeyHint="done"
              autoFocus={!folder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "folder-sheet-error" : undefined}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        {error && (
          <p id="folder-sheet-error" className="mt-1 text-sm text-danger-ink">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl bg-bg font-semibold text-ink active:bg-ink/10 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-2xl bg-accent font-semibold text-white active:opacity-85 disabled:opacity-60"
          >
            {folder ? "Salvar" : "Criar pasta"}
          </button>
        </div>

        {folder && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsking(true)}
            className="mt-2 w-full rounded-2xl text-sm font-semibold text-danger-ink active:bg-danger/10"
          >
            Apagar pasta
          </button>
        )}
      </form>

      {asking && (
        <AskSheet
          question={question}
          detail={n > 0 ? "Não dá para desfazer." : undefined}
          confirmLabel="Apagar"
          onConfirm={remove}
          onClose={() => setAsking(false)}
        />
      )}
    </dialog>
  );
}
