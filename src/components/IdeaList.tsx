import type { Folder, Idea } from "../../shared/types";
import { ago, linkHost, safeThumb } from "../lib/format";
import { FolderGlyph, ideaCount, MusicIcon } from "./FolderGrid";
import { Button, IconButton } from "./ui/Button";
import { ChevronLeftIcon, LightbulbIcon, LinkIcon, PinIcon, PlusIcon, VideoIcon } from "./ui/Icon";

interface Props {
  folder: Folder;
  ideas: Idea[] | null;
  error: string | null;
  now: Date;
  onReload: () => void;
  /** Sem voltar no computador: as colunas já mostram onde se está. */
  onBack?: () => void;
  onOpen: (idea: Idea) => void;
  onNew: () => void;
  onTogglePin: (idea: Idea) => void;
  /** Computador: o botão fica no topo da coluna (não no canto da janela) e a ideia aberta fica marcada. */
  wide?: boolean;
  selectedId?: string | null;
}

/** Selo de onde o link veio: "tiktok.com". */
export function LinkChip({ url }: { url: string }) {
  const host = linkHost(url);
  if (!host) return null;
  const Icon = host.includes("tiktok") ? MusicIcon : host.includes("youtu") ? VideoIcon : LinkIcon;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg bg-bg px-2 py-0.5 text-xs font-medium text-muted">
      <Icon size={12} />
      <span className="truncate">{host}</span>
    </span>
  );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Voltar para ${label}`}
      onClick={onClick}
      className="no-select -ml-2 inline-flex min-h-11 max-w-full items-center gap-0.5 rounded-xl px-2 text-[15px] font-medium text-accent-ink transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent active:bg-accent-soft"
    >
      <ChevronLeftIcon size={20} strokeWidth={2.2} />
      <span className="truncate">{label}</span>
    </button>
  );
}

interface CardProps {
  idea: Idea;
  now: Date;
  selected?: boolean;
  /** Pasta de origem (aparece na visão "Recentes"). */
  folder?: Folder | null;
  onOpen: (idea: Idea) => void;
  onTogglePin: (idea: Idea) => void;
}

/** Cartão de uma ideia: abre o editor; o botão de fixar fica ao lado, fora do botão do cartão. */
export function IdeaCard({ idea, now, selected = false, folder, onOpen, onTogglePin }: CardProps) {
  const thumb = safeThumb(idea.linkThumb);
  return (
    <li className="relative">
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onOpen(idea)}
        className={`flex h-full w-full gap-3 rounded-2xl border-[1.5px] bg-surface py-3 pr-14 pl-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-dot hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
          selected ? "border-accent" : "border-transparent"
        }`}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            width={48}
            height={64}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-16 w-12 shrink-0 rounded-lg bg-bg object-cover"
          />
        )}
        <span className="block min-w-0 flex-1">
          <b className="line-clamp-2 block leading-snug font-semibold break-words">{idea.title}</b>
          {idea.body && <span className="mt-0.5 line-clamp-2 text-sm text-muted">{idea.body}</span>}
          <span className="mt-2 flex items-center justify-between gap-2 text-meta text-muted">
            {folder ? (
              <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg bg-accent-soft px-2 py-0.5 font-medium text-accent-ink">
                <span className="truncate">{folder.name}</span>
              </span>
            ) : idea.linkUrl ? (
              <LinkChip url={idea.linkUrl} />
            ) : (
              <span />
            )}
            <span className="shrink-0">
              {idea.pinned && <span className="font-medium text-accent-ink">fixada · </span>}
              <time dateTime={idea.updatedAt}>{ago(idea.updatedAt, now)}</time>
            </span>
          </span>
        </span>
      </button>
      <IconButton
        label="Fixar no topo"
        aria-pressed={idea.pinned}
        size="sm"
        icon={<PinIcon size={16} className={idea.pinned ? "fill-current" : ""} />}
        onClick={() => onTogglePin(idea)}
        className={`absolute! top-1.5 right-1.5 ${idea.pinned ? "bg-accent-soft text-accent-ink" : "text-muted"}`}
      />
    </li>
  );
}

function Skeleton({ cols = false }: { cols?: boolean }) {
  return (
    <div role="status" className={cols ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
      <span className="sr-only">Carregando…</span>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden className="h-20 rounded-2xl bg-surface motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

function ErrorBox({ error, onReload }: { error: string; onReload: () => void }) {
  return (
    <div role="alert" className="rounded-[20px] bg-surface px-4 py-5 text-center text-sm">
      <p className="mb-3 text-danger-ink">{error}</p>
      <Button variant="secondary" size="sm" onClick={onReload}>
        Tentar de novo
      </Button>
    </div>
  );
}

/** Ideias de uma pasta: fixadas no topo, depois da mais recente para a mais antiga. */
export function IdeaList(props: Props) {
  const { folder, ideas, error, now, onReload, onBack, onOpen, onNew, onTogglePin, wide = false, selectedId = null } = props;
  const Heading = wide ? "h2" : "h1";
  return (
    <section aria-labelledby="idea-list-title">
      {onBack && <BackButton label="Ideias" onClick={onBack} />}
      <header className={wide ? "mb-3 flex items-start justify-between gap-2 pl-1" : "mt-1 mb-3"}>
        <div className="min-w-0">
          <Heading
            id="idea-list-title"
            className={`flex items-center gap-2 font-display leading-tight font-semibold tracking-[-0.01em] ${wide ? "text-xl" : "text-[28px]"}`}
          >
            <FolderGlyph folder={folder} size={wide ? 28 : 34} className="rounded-lg" />
            <span className="min-w-0 break-words">{folder.name}</span>
          </Heading>
          {ideas && <p className="mt-0.5 text-sm text-muted">{ideaCount(ideas.length)}</p>}
        </div>
        {wide && (
          <Button variant="secondary" size="sm" icon={<PlusIcon size={16} strokeWidth={2.4} />} onClick={onNew}>
            Nova ideia
          </Button>
        )}
      </header>

      {error && !ideas ? (
        <ErrorBox error={error} onReload={onReload} />
      ) : !ideas ? (
        <Skeleton />
      ) : ideas.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-5 py-7 text-center">
          <p className="font-semibold">Nenhuma ideia aqui ainda</p>
          <p className="mt-1 text-sm text-muted">
            {wide ? "Clique em Nova ideia para escrever a primeira, ou use a captura do Hoje." : "Toque em + para escrever a primeira, ou use a captura aí embaixo."}
          </p>
        </div>
      ) : (
        <ul aria-label="Ideias da pasta" className="space-y-2">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} now={now} selected={idea.id === selectedId} onOpen={onOpen} onTogglePin={onTogglePin} />
          ))}
        </ul>
      )}

      {!wide && (
        <button
          type="button"
          aria-label="Nova ideia"
          title="Nova ideia"
          onClick={onNew}
          className="no-select fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-accent-fill text-on-accent shadow-[0_10px_24px_-8px_var(--accent)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 5rem)" }}
        >
          <PlusIcon size={24} strokeWidth={2.4} />
        </button>
      )}
    </section>
  );
}

interface RecentProps {
  ideas: Idea[] | null;
  error: string | null;
  folders: Folder[];
  now: Date;
  onReload: () => void;
  onOpen: (idea: Idea) => void;
  onTogglePin: (idea: Idea) => void;
  /** Sem pasta para criar, o botão some. */
  onNew?: () => void;
}

/** Computador, nenhuma pasta aberta: as ideias mais recentes de todas as pastas, em cartões. */
export function RecentIdeas({ ideas, error, folders, now, onReload, onOpen, onTogglePin, onNew }: RecentProps) {
  return (
    <section aria-labelledby="recent-title">
      <header className="mb-3 flex items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <h2 id="recent-title" className="font-display text-xl leading-tight font-semibold">
            Recentes
          </h2>
          <p className="mt-0.5 text-sm text-muted">Fixadas primeiro, depois as mais novas de todas as pastas.</p>
        </div>
        {onNew && (
          <Button variant="secondary" size="sm" icon={<PlusIcon size={16} strokeWidth={2.4} />} onClick={onNew}>
            Nova ideia
          </Button>
        )}
      </header>

      {error && !ideas ? (
        <ErrorBox error={error} onReload={onReload} />
      ) : !ideas ? (
        <Skeleton cols />
      ) : ideas.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-5 py-7 text-center">
          <p className="font-semibold">Nenhuma ideia ainda</p>
          <p className="mt-1 text-sm text-muted">Abra uma pasta e escreva a primeira, ou use a captura do Hoje.</p>
        </div>
      ) : (
        <ul aria-label="Ideias recentes" className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              now={now}
              folder={folders.find((f) => f.id === idea.folderId) ?? null}
              onOpen={onOpen}
              onTogglePin={onTogglePin}
            />
          ))}
        </ul>
      )}

      <p className="mt-5 flex items-center gap-2 pl-1 text-sm text-muted">
        <LightbulbIcon size={16} />
        Clique numa ideia para abrir o editor nesta área.
      </p>
    </section>
  );
}
