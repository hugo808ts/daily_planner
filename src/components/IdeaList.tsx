import type { Folder, Idea } from "../../shared/types";
import { ago, linkHost, safeThumb } from "../lib/format";
import { ideaCount } from "./FolderGrid";

interface Props {
  folder: Folder;
  ideas: Idea[] | null;
  error: string | null;
  now: Date;
  onReload: () => void;
  onBack: () => void;
  onOpen: (idea: Idea) => void;
  onNew: () => void;
  onTogglePin: (idea: Idea) => void;
}

const hostIcon = (host: string) => (host.includes("tiktok") ? "♪" : host.includes("youtu") ? "▶" : "🔗");

/** Selo de onde o link veio: "♪ tiktok.com". */
export function LinkChip({ url }: { url: string }) {
  const host = linkHost(url);
  if (!host) return null;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg bg-bg px-2 py-0.5 text-xs font-medium text-ink/75">
      <span aria-hidden>{hostIcon(host)}</span>
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
      className="-ml-2 inline-flex max-w-full items-center gap-0.5 rounded-xl px-2 text-[15px] font-medium text-accent active:bg-accent/10"
    >
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Ideias de uma pasta: fixadas no topo, depois da mais recente para a mais antiga. */
export function IdeaList({ folder, ideas, error, now, onReload, onBack, onOpen, onNew, onTogglePin }: Props) {
  return (
    <section aria-labelledby="idea-list-title">
      <BackButton label="Ideias" onClick={onBack} />
      <header className="mt-1 mb-3">
        <h1 id="idea-list-title" className="font-display text-[28px] leading-tight font-semibold tracking-[-0.01em] break-words">
          {folder.emoji && <span aria-hidden>{folder.emoji} </span>}
          {folder.name}
        </h1>
        {ideas && <p className="text-sm text-muted">{ideaCount(ideas.length)}</p>}
      </header>

      {error && !ideas ? (
        <div role="alert" className="rounded-[20px] bg-surface px-4 py-5 text-center text-sm">
          <p className="mb-2 text-danger-ink">{error}</p>
          <button type="button" onClick={onReload} className="rounded-xl bg-accent/10 px-4 font-semibold text-accent active:bg-accent/20">
            Tentar de novo
          </button>
        </div>
      ) : !ideas ? (
        <div aria-busy="true" aria-label="Carregando" className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-surface motion-safe:animate-pulse" />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-5 py-7 text-center">
          <p className="font-semibold">Nenhuma ideia aqui ainda</p>
          <p className="mt-1 text-sm text-muted">Toque em + para escrever a primeira, ou use a captura aí embaixo.</p>
        </div>
      ) : (
        <ul aria-label="Ideias da pasta" className="space-y-2">
          {ideas.map((idea) => {
            const thumb = safeThumb(idea.linkThumb);
            return (
              <li key={idea.id} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(idea)}
                  className="flex w-full gap-3 rounded-2xl bg-surface py-3 pr-12 pl-4 text-left transition-colors duration-150 active:bg-surface/70"
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-16 w-12 shrink-0 rounded-lg bg-bg object-cover"
                    />
                  )}
                  <span className="block min-w-0 flex-1">
                    <b className="block leading-snug font-semibold break-words">{idea.title}</b>
                    {idea.body && <span className="mt-0.5 line-clamp-2 text-sm text-muted">{idea.body}</span>}
                    <span className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                      {idea.linkUrl ? <LinkChip url={idea.linkUrl} /> : <span />}
                      <span className={`shrink-0 ${idea.pinned ? "font-medium text-accent" : ""}`}>
                        {idea.pinned ? "fixada" : ago(idea.updatedAt, now)}
                      </span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={idea.pinned ? "Desafixar" : "Fixar no topo"}
                  aria-pressed={idea.pinned}
                  onClick={() => onTogglePin(idea)}
                  className={`absolute top-0.5 right-0.5 grid place-items-center rounded-xl transition-opacity duration-150 active:bg-ink/5 ${
                    idea.pinned ? "opacity-100" : "opacity-35 grayscale"
                  }`}
                >
                  <span aria-hidden className="text-base">
                    📌
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        aria-label="Nova ideia"
        onClick={onNew}
        className="fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-accent text-white shadow-[0_10px_24px_-8px_var(--accent)] active:opacity-85"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 5rem)" }}
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
        </svg>
      </button>
    </section>
  );
}
