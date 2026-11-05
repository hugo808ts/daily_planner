import { Music, Star } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FOLDER_NAME_MAX } from "../../shared/limits";
import type { Folder } from "../../shared/types";
import { api, ApiError, type FoundIdea } from "../lib/api";
import { plural } from "../lib/format";
import { AskSheet } from "./AskSheet";
import { FolderIconPicker } from "./FolderIconPicker";
import { showToast } from "./Toast";
import { Button, IconButton } from "./ui/Button";
import {
  BookOpenIcon,
  BriefcaseIcon,
  ClockIcon,
  CloseIcon,
  FolderIcon,
  FolderPlusIcon,
  HeartIcon,
  LightbulbIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  VideoIcon,
  type IconComponent,
  type IconProps,
} from "./ui/Icon";

const SEARCH_DEBOUNCE_MS = 250;

const FIELD =
  "block w-full min-h-11 rounded-xl border border-line bg-bg px-3 py-2.5 text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-invalid:border-danger";

const StarIcon: IconComponent = ({ size = 20, strokeWidth = 2, className, ...rest }: IconProps) => (
  <Star size={size} strokeWidth={strokeWidth} aria-hidden focusable="false" className={className ? `shrink-0 ${className}` : "shrink-0"} {...rest} />
);
export const MusicIcon: IconComponent = ({ size = 20, strokeWidth = 2, className, ...rest }: IconProps) => (
  <Music size={size} strokeWidth={strokeWidth} aria-hidden focusable="false" className={className ? `shrink-0 ${className}` : "shrink-0"} {...rest} />
);

/**
 * Ícones de pasta. A chave vai no campo `emoji` (o servidor aceita até 8 caracteres, por isso "i:…").
 * `null` = pasta sem ícone escolhido (mostra a pasta padrão). Valores antigos (emoji de verdade) continuam
 * sendo exibidos como estão.
 */
export const FOLDER_ICONS: { key: string | null; label: string; Icon: IconComponent }[] = [
  { key: null, label: "Pasta", Icon: FolderIcon },
  { key: "i:book", label: "Livro", Icon: BookOpenIcon },
  { key: "i:idea", label: "Lâmpada", Icon: LightbulbIcon },
  { key: "i:video", label: "Vídeo", Icon: VideoIcon },
  { key: "i:work", label: "Trabalho", Icon: BriefcaseIcon },
  { key: "i:heart", label: "Coração", Icon: HeartIcon },
  { key: "i:star", label: "Estrela", Icon: StarIcon },
  { key: "i:music", label: "Música", Icon: MusicIcon },
];

export const isIconKey = (v: string | null | undefined): v is string => !!v && v.startsWith("i:");
const iconFor = (v: string | null | undefined): IconComponent | null =>
  FOLDER_ICONS.find((i) => i.key === v)?.Icon ?? null;

function hueOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Fundo do ícone da pasta: um tom estável por pasta, misturado com a superfície (claro e escuro). */
export function folderTint(id: string): string {
  return `color-mix(in srgb, hsl(${hueOf(id)} 75% 62%) 22%, var(--surface))`;
}

/** Cor do traço: o mesmo tom, puxado para a cor do texto para manter contraste. */
const folderInk = (id: string): string => `color-mix(in srgb, hsl(${hueOf(id)} 70% 48%) 55%, var(--ink))`;

/** Quadradinho colorido com o ícone da pasta (ou o emoji antigo). Decorativo. */
export function FolderGlyph({
  folder,
  size = 36,
  className = "",
  plain = false,
}: {
  folder: Pick<Folder, "id" | "emoji">;
  size?: number;
  className?: string;
  /** Sem fundo colorido (para usar dentro de chips). */
  plain?: boolean;
}) {
  const Icon = iconFor(folder.emoji) ?? (isIconKey(folder.emoji) || !folder.emoji ? FolderIcon : null);
  const style: CSSProperties = {
    background: plain ? "transparent" : folderTint(folder.id),
    color: folderInk(folder.id),
    width: size,
    height: size,
  };
  return (
    <span aria-hidden className={`no-select grid shrink-0 place-items-center rounded-[11px] ${className}`} style={style}>
      {Icon ? <Icon size={Math.round(size * 0.5)} /> : <span style={{ fontSize: size * 0.5 }}>{folder.emoji}</span>}
    </span>
  );
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
  /** Computador: coluna estreita com a lista de pastas (em vez da grade). */
  sidebar?: boolean;
  /** Pasta aberta na coluna ao lado (só no computador). */
  selectedId?: string | null;
  /** Computador: "Recentes" está aberto (nenhuma pasta escolhida). */
  recentSelected?: boolean;
  onOpenRecent?: () => void;
}

/** Tela inicial das Ideias: busca em todas as pastas e a grade de pastas. */
export function FolderGrid(props: Props) {
  const {
    folders,
    error,
    query,
    onQuery,
    onReload,
    onOpenFolder,
    sidebar = false,
    selectedId = null,
    recentSelected = false,
    onOpenRecent,
  } = props;
  const [sheet, setSheet] = useState<{ folder: Folder | null } | null>(null);
  const searching = query.trim().length > 0;

  return (
    <section aria-labelledby="ideas-title">
      <header className={`flex items-center justify-between gap-3 ${sidebar ? "mb-2 pl-1" : "mb-3"}`}>
        <h1
          id="ideas-title"
          className={
            sidebar
              ? "font-display text-xl leading-tight font-semibold"
              : "font-display text-[28px] leading-tight font-semibold tracking-[-0.01em]"
          }
        >
          Ideias
        </h1>
        <IconButton
          label="Nova pasta"
          variant="primary"
          size={sidebar ? "md" : "lg"}
          icon={<PlusIcon size={sidebar ? 18 : 20} strokeWidth={2.4} />}
          onClick={() => setSheet({ folder: null })}
        />
      </header>

      <div className={`relative ${sidebar ? "mb-3" : "mb-4"}`}>
        <label htmlFor="ideas-search" className="sr-only">
          Buscar em todas as ideias
        </label>
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input
          id="ideas-search"
          name="busca"
          type="search"
          value={query}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar em todas as ideias…"
          onChange={(e) => onQuery(e.target.value)}
          className="block min-h-11 w-full truncate rounded-2xl border border-transparent bg-surface py-2.5 pr-11 pl-10 text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <IconButton
            label="Limpar busca"
            size="sm"
            icon={<CloseIcon size={16} />}
            onClick={() => onQuery("")}
            className="absolute! top-1/2 right-1.5 -translate-y-1/2 text-muted"
          />
        )}
      </div>

      {searching ? (
        <SearchResults query={query.trim()} folders={folders ?? []} onOpen={props.onOpenIdea} />
      ) : error && !folders ? (
        <div role="alert" className="rounded-[20px] bg-surface px-4 py-5 text-center text-sm">
          <p className="mb-3 text-danger-ink">{error}</p>
          <Button variant="secondary" size="sm" onClick={onReload}>
            Tentar de novo
          </Button>
        </div>
      ) : !folders ? (
        <div role="status" className={sidebar ? "space-y-1" : "grid grid-cols-2 gap-2.5"}>
          <span className="sr-only">Carregando…</span>
          {[0, 1].map((i) => (
            <div key={i} aria-hidden className={`rounded-[20px] bg-surface motion-safe:animate-pulse ${sidebar ? "h-10" : "h-[104px]"}`} />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-5 py-7 text-center">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
            <FolderPlusIcon size={24} />
          </span>
          <h2 className="mt-3 font-display text-xl font-semibold">Crie sua primeira pasta</h2>
          <p className="mx-auto mt-1 max-w-[30ch] text-sm text-muted">
            Toda ideia mora numa pasta: estudos, vídeos para ver, projetos… Você escolhe os nomes.
          </p>
          <Button variant="primary" className="mt-4" icon={<PlusIcon size={18} />} onClick={() => setSheet({ folder: null })}>
            Nova pasta
          </Button>
        </div>
      ) : sidebar ? (
        <>
          <h2 className="mx-2 mb-1.5 text-xs font-medium text-muted">Pastas</h2>
          <ul aria-label="Pastas" className="space-y-0.5">
            <li>
              <button
                type="button"
                aria-current={recentSelected ? "true" : undefined}
                onClick={() => onOpenRecent?.()}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl py-1.5 pr-2 pl-2 text-left text-[14px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                  recentSelected ? "bg-surface font-semibold shadow-[0_1px_2px_rgb(36_32_58/0.08)]" : "hover:bg-ink/[0.05] active:bg-ink/[0.07]"
                }`}
              >
                <span aria-hidden className="no-select grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                  <ClockIcon size={15} />
                </span>
                Recentes
              </button>
            </li>
            {folders.map((f) => {
              const on = f.id === selectedId;
              return (
                <li key={f.id} className="group relative">
                  <button
                    type="button"
                    aria-label={`Abrir pasta ${f.name}, ${ideaCount(f.openCount)}`}
                    aria-current={on ? "true" : undefined}
                    onClick={() => onOpenFolder(f)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-xl py-1.5 pr-11 pl-2 text-left text-[14px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                      on ? "bg-surface font-semibold shadow-[0_1px_2px_rgb(36_32_58/0.08)]" : "hover:bg-ink/[0.05] active:bg-ink/[0.07]"
                    }`}
                  >
                    <FolderGlyph folder={f} size={28} className="rounded-lg" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  </button>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted tabular-nums group-focus-within:opacity-0 group-hover:opacity-0 pointer-coarse:hidden"
                  >
                    {f.openCount}
                  </span>
                  <IconButton
                    label={`Editar pasta ${f.name}`}
                    size="sm"
                    tooltip={false}
                    icon={<MoreIcon size={16} />}
                    onClick={() => setSheet({ folder: f })}
                    className="absolute! top-1/2 right-1 -translate-y-1/2 text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                  />
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul aria-label="Pastas" className="grid grid-cols-2 gap-2.5">
          {folders.map((f) => (
            <li key={f.id} className="relative">
              <button
                type="button"
                aria-label={`Abrir pasta ${f.name}, ${ideaCount(f.openCount)}`}
                onClick={() => onOpenFolder(f)}
                className="flex min-h-[104px] w-full flex-col justify-between rounded-[20px] bg-surface p-3 text-left transition-[transform,box-shadow] duration-150 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:transition-none"
              >
                <FolderGlyph folder={f} size={38} />
                <span className="mt-2 block min-w-0">
                  <b className="block truncate pr-1 text-[15px] font-semibold">{f.name}</b>
                  <small className="text-meta text-muted">{ideaCount(f.openCount)}</small>
                </span>
              </button>
              <IconButton
                label={`Editar pasta ${f.name}`}
                size="sm"
                tooltip={false}
                icon={<MoreIcon size={18} />}
                onClick={() => setSheet({ folder: f })}
                className="absolute! top-1.5 right-1.5 text-muted"
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setSheet({ folder: null })}
              className="grid min-h-[104px] w-full place-items-center rounded-[20px] border-[1.5px] border-dashed border-dot text-sm font-medium text-muted transition-colors hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-ink/5"
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

  if (error)
    return (
      <p role="alert" className="px-1 text-sm text-danger-ink">
        {error}
      </p>
    );
  if (!results)
    return (
      <p role="status" className="px-1 text-sm text-muted">
        Buscando…
      </p>
    );
  if (results.ideas.length === 0)
    return (
      <p role="status" className="px-1 text-sm break-words text-muted">
        Nada encontrado para “{results.q}”.
      </p>
    );

  return (
    <div>
      <p role="status" aria-live="polite" className="mb-2 px-1 text-xs text-muted">
        {plural(results.ideas.length, "resultado", "resultados")}
      </p>
      <ul aria-label="Resultados da busca" className="space-y-2">
        {results.ideas.map((idea) => {
          const folder = folders.find((f) => f.id === idea.folderId);
          return (
            <li key={idea.id}>
              <button
                type="button"
                onClick={() => onOpen(idea)}
                className="block w-full rounded-2xl bg-surface px-4 py-3 text-left transition-colors hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-surface/70"
              >
                <span className="mb-1 flex max-w-full items-center gap-1.5 text-xs font-medium text-muted">
                  {folder && <FolderGlyph folder={folder} size={16} plain />}
                  <span className="truncate">{idea.folderName}</span>
                </span>
                <b className="block truncate font-semibold">{idea.title}</b>
                {idea.body && <span className="mt-0.5 line-clamp-2 text-sm text-muted">{idea.body}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface SheetProps {
  folder: Folder | null;
  onClose: () => void;
  onSaved: (folder: Folder) => void;
  onDeleted: (id: string) => void;
}

/** Criar ou editar uma pasta (nome + ícone); editar também permite apagar. */
function FolderSheet({ folder, onClose, onSaved, onDeleted }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(folder?.name ?? "");
  const [icon, setIcon] = useState<string | null>(folder?.emoji ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const title = folder ? "Editar pasta" : "Nova pasta";
  const legacy = folder?.emoji ?? null;
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

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
      const input = { name, emoji: icon };
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

        <label htmlFor="folder-name" className="mb-1 block text-xs font-medium text-muted">
          Nome da pasta
        </label>
        <input
          id="folder-name"
          name="nome"
          value={name}
          maxLength={FOLDER_NAME_MAX}
          placeholder="Ex.: Estudos…"
          enterKeyHint="done"
          autoComplete="off"
          autoFocus={!folder && !touch}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "folder-sheet-error" : undefined}
          onChange={(e) => setName(e.target.value)}
          className={FIELD}
        />
        {error && (
          <p id="folder-sheet-error" role="alert" className="mt-1 text-sm text-danger-ink">
            {error}
          </p>
        )}

        <FolderIconPicker value={icon} onChange={setIcon} legacy={legacy} />

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="flex-1" busy={busy} busyLabel="Salvando…">
            {folder ? "Salvar" : "Criar pasta"}
          </Button>
        </div>

        {folder && (
          <Button variant="danger" className="mt-2 w-full" disabled={busy} onClick={() => setAsking(true)}>
            Apagar pasta
          </Button>
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
