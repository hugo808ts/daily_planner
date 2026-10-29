import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { IDEA_BODY_MAX, IDEA_TITLE_MAX } from "../../shared/limits";
import type { Idea } from "../../shared/types";
import { api, ApiError, type IdeaPatch } from "../lib/api";
import { dayMonth, findLinks, linkHost, safeThumb } from "../lib/format";
import { AskSheet } from "./AskSheet";
import { BackButton } from "./IdeaList";
import { showToast } from "./Toast";

/** Espera depois da última tecla antes de salvar. */
export const AUTOSAVE_MS = 800;

interface Props {
  folderId: string;
  folderName: string;
  /** null = ideia nova (só é criada quando o título deixa de estar vazio). */
  idea: Idea | null;
  /** Sem voltar no computador (a lista fica ao lado). */
  onBack?: () => void;
  /** Computador: coluna larga; ações no topo, texto direto na página. */
  wide?: boolean;
  onSaved: (idea: Idea, created: boolean) => void;
  onResolved: (deleted: Idea) => void;
  onTurnIntoTask: (idea: Idea) => void;
}

interface Draft {
  title: string;
  body: string;
  link: string;
}

/** "tiktok.com/x" vira "https://tiktok.com/x"; vazio vira null; inválido vira undefined (não envia). */
function normalizeLink(raw: string): string | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : s.includes(".") ? `https://${s}` : s;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? withScheme : undefined;
  } catch {
    return undefined;
  }
}

/** O que mudou entre o rascunho e o que o servidor tem. */
function diff(d: Draft, s: Idea): IdeaPatch {
  const patch: IdeaPatch = {};
  if (d.title.trim() && d.title.trim() !== s.title) patch.title = d.title.trim();
  if (d.body !== s.body) patch.body = d.body;
  const link = normalizeLink(d.link);
  if (link !== undefined && link !== s.linkUrl) patch.linkUrl = link;
  return patch;
}

function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

type SaveState = "idle" | "dirty" | "saved" | "error";

const draftKey = (folderId: string, idea: Idea | null) => `agenda:idea-draft:${idea ? idea.id : `new:${folderId}`}`;

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    return typeof d.title === "string" && typeof d.body === "string" && typeof d.link === "string"
      ? { title: d.title, body: d.body, link: d.link }
      : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, d: Draft | null): void {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    // Sem armazenamento local: nada a fazer.
  }
}

/** Título de uma ideia nova só com texto: a primeira linha do texto. */
const titleFromBody = (body: string): string => (body.split(/\r?\n/).find((l) => l.trim()) ?? "").trim().slice(0, 160);

const SAVE_FAILED = "Não salvou — verifique a conexão";

/** Editor de uma ideia: salva sozinho (800 ms depois de parar de digitar, ao sair do campo e ao voltar). */
export function IdeaEditor({ folderId, folderName, idea, onBack, wide = false, onSaved, onResolved, onTurnIntoTask }: Props) {
  const baseline: Draft = { title: idea?.title ?? "", body: idea?.body ?? "", link: idea?.linkUrl ?? "" };
  // Rascunho que não chegou ao servidor da última vez (falha de rede ao sair): volta para a tela.
  const [restored] = useState<Draft | null>(() => {
    const d = readDraft(draftKey(folderId, idea));
    return d && (d.title !== baseline.title || d.body !== baseline.body || d.link !== baseline.link) ? d : null;
  });
  const [draft, setDraft] = useState<Draft>(restored ?? baseline);
  const [saved, setSaved] = useState<Idea | null>(idea);
  const [state, setState] = useState<SaveState>(restored ? "dirty" : idea ? "saved" : "idle");
  const [leaveError, setLeaveError] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState(false);

  const draftRef = useRef(draft);
  const mounted = useRef(true);
  const lastOk = useRef(true);
  const savedRef = useRef(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const gone = useRef(false);
  const props = useRef({ onSaved });
  props.current = { onSaved };

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(titleRef, draft.title);
  useAutosize(bodyRef, draft.body);

  const commit = (next: Idea, created: boolean) => {
    savedRef.current = next;
    setSaved(next);
    props.current.onSaved(next, created);
  };

  /** Um salvamento por vez; cada um envia só o que ainda difere do servidor. */
  const runSave = useCallback(async () => {
    lastOk.current = true;
    if (gone.current) return;
    const d = draftRef.current;
    const s = savedRef.current;
    const key = draftKey(folderId, s);
    try {
      if (!s) {
        // Sem título mas com texto: a primeira linha do texto vira o título (nunca perder o que foi escrito).
        const title = d.title.trim() || titleFromBody(d.body);
        if (!title) return;
        const link = normalizeLink(d.link);
        const created = await api.createIdea({ folderId, title, body: d.body, linkUrl: link ?? null });
        if (!d.title.trim() && !draftRef.current.title.trim()) {
          draftRef.current = { ...draftRef.current, title: created.title };
          setDraft(draftRef.current);
        }
        commit(created, true);
      } else {
        const patch = diff(d, s);
        if (Object.keys(patch).length === 0) return;
        commit(await api.updateIdea(s.id, patch), false);
      }
      writeDraft(key, null);
      writeDraft(draftKey(folderId, null), null);
      setLeaveError(false);
      setFields({});
    } catch (e) {
      lastOk.current = false;
      writeDraft(key, d);
      if (!mounted.current) {
        showToast("Não salvou a ideia. Guardamos o texto neste aparelho; abra a ideia de novo para tentar.");
      } else {
        setState("error");
        if (e instanceof ApiError && e.fields) setFields(e.fields);
      }
      return;
    } finally {
      const now = draftRef.current;
      const srv = savedRef.current;
      const pending = srv ? Object.keys(diff(now, srv)).length > 0 : !!(now.title.trim() || now.body.trim());
      setState((st) => (st === "error" ? st : pending ? "dirty" : srv ? "saved" : "idle"));
    }
  }, [folderId]);

  /** Salva o que falta; resolve true se não há nada pendente no fim. */
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    chain.current = chain.current.then(runSave);
    return chain.current.then(() => lastOk.current);
  }, [runSave]);

  const change = (patch: Partial<Draft>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setState(next.title.trim() || next.body.trim() || savedRef.current ? "dirty" : "idle");
    setLeaveError(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  };

  // Nunca perder texto: salva ao sair do editor e quando o app vai para o fundo.
  useEffect(() => {
    mounted.current = true;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  // Rascunho recuperado: tenta salvar de novo.
  useEffect(() => {
    if (!restored) return;
    showToast("Recuperamos o texto que não foi salvo.");
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Só volta se tudo foi salvo; senão fica na ideia, com o texto à vista.
  const back = async () => {
    if (await flush()) onBack?.();
    else setLeaveError(true);
  };

  // Na mesma fila dos salvamentos, para dois PATCH nunca se cruzarem.
  const togglePin = () => {
    void flush();
    chain.current = chain.current.then(async () => {
      const s = savedRef.current;
      if (!s || gone.current) return;
      try {
        commit(await api.updateIdea(s.id, { pinned: !s.pinned }), false);
      } catch (e) {
        showToast(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
      }
    });
  };

  const resolve = async () => {
    await flush();
    const s = savedRef.current;
    if (!s) return;
    try {
      const deleted = await api.deleteIdea(s.id);
      gone.current = true;
      onResolved(deleted);
    } catch (e) {
      setAsking(false);
      showToast(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    }
  };

  const turnIntoTask = async () => {
    await flush();
    if (savedRef.current) onTurnIntoTask(savedRef.current);
  };

  const linkNow = normalizeLink(draft.link);
  const preview = saved?.linkUrl && saved.linkUrl === linkNow ? saved : null;
  const thumb = safeThumb(preview?.linkThumb ?? null);
  const bodyLinks = findLinks(draft.body);
  const linkError = fields.linkUrl ?? (draft.link.trim() && linkNow === undefined ? "Link inválido (use http ou https)." : null);

  const status =
    state === "error"
      ? null
      : state === "dirty"
        ? "Salvando…"
        : state === "saved"
          ? "Salvo"
          : "Escreva para salvar";

  const actions = (
    <div className={wide ? "flex shrink-0 gap-2" : "mt-5 flex gap-2"}>
      <button
        type="button"
        disabled={!saved}
        onClick={() => void turnIntoTask()}
        className={`rounded-2xl font-semibold text-ink disabled:opacity-50 ${
          wide ? "bg-bg px-4 text-sm active:bg-ink/10" : "flex-1 bg-surface py-3 active:bg-surface/70"
        }`}
      >
        📅 Virar tarefa
      </button>
      <button
        type="button"
        disabled={!saved}
        onClick={() => setAsking(true)}
        className={`rounded-2xl bg-ink font-semibold text-bg active:opacity-85 disabled:opacity-50 ${wide ? "px-4 text-sm" : "flex-1 py-3"}`}
      >
        ✓ Resolvida
      </button>
    </div>
  );

  return (
    <section aria-label="Editor da ideia">
      <div className="flex items-center justify-between gap-2">
        {onBack ? <BackButton label={folderName} onClick={() => void back()} /> : <span className="truncate text-sm text-muted">{folderName}</span>}
        <div className="flex shrink-0 items-center gap-1">
          <span data-testid="save-state" aria-live="polite" className="text-xs text-muted">
            {status}
          </span>
          {state === "error" && (
            <button
              type="button"
              onClick={() => {
                setState("dirty");
                void flush();
              }}
              className="rounded-xl px-2 text-xs font-semibold text-danger-ink active:bg-danger/10"
            >
              Não salvou · Tentar de novo
            </button>
          )}
          <button
            type="button"
            aria-label={saved?.pinned ? "Desafixar" : "Fixar no topo"}
            aria-pressed={saved?.pinned ?? false}
            disabled={!saved}
            onClick={togglePin}
            className={`grid place-items-center rounded-xl active:bg-ink/5 disabled:opacity-20 ${saved?.pinned ? "" : "opacity-35 grayscale"}`}
          >
            <span aria-hidden>📌</span>
          </button>
          {wide && actions}
        </div>
      </div>

      <label htmlFor="idea-title" className="sr-only">
        Título
      </label>
      <textarea
        id="idea-title"
        ref={titleRef}
        rows={1}
        value={draft.title}
        maxLength={IDEA_TITLE_MAX}
        placeholder="Título da ideia"
        enterKeyHint="next"
        autoFocus={!idea}
        aria-invalid={fields.title ? true : undefined}
        onChange={(e) => change({ title: e.target.value.replace(/\n/g, " ") })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            bodyRef.current?.focus();
          }
        }}
        onBlur={() => void flush()}
        className={`mt-2 block w-full resize-none overflow-hidden bg-transparent font-display leading-tight font-semibold text-ink placeholder:text-muted/70 focus:outline-none ${
          wide ? "text-[30px]" : "text-[24px]"
        }`}
      />
      {leaveError && (
        <p role="alert" className="text-sm text-danger-ink">
          {SAVE_FAILED}
        </p>
      )}
      {fields.title && <p className="text-sm text-danger-ink">{fields.title}</p>}
      {saved && <p className="mt-1 text-xs text-muted">Criada em {dayMonth(saved.createdAt)}</p>}

      <div className="mt-4">
        <label htmlFor="idea-link" className="sr-only">
          Link
        </label>
        <input
          id="idea-link"
          type="url"
          inputMode="url"
          value={draft.link}
          autoComplete="off"
          placeholder="🔗 Cole um link (TikTok, YouTube…)"
          aria-invalid={linkError ? true : undefined}
          aria-describedby={linkError ? "idea-link-error" : undefined}
          onChange={(e) => change({ link: e.target.value })}
          onBlur={() => {
            const n = normalizeLink(draft.link);
            if (n && n !== draft.link) change({ link: n });
            void flush();
          }}
          className={`block min-h-11 w-full rounded-xl border border-line px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none aria-invalid:border-danger ${
            wide ? "max-w-[460px] bg-bg" : "bg-surface"
          }`}
        />
        {linkError && (
          <p id="idea-link-error" className="mt-1 text-sm text-danger-ink">
            {linkError}
          </p>
        )}
        {preview?.linkUrl && (
          <a
            href={preview.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 flex gap-3 rounded-2xl p-2 ${wide ? "max-w-[460px] bg-bg active:bg-ink/10" : "bg-surface active:bg-surface/70"}`}
          >
            {thumb ? (
              <img
                src={thumb}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-[72px] w-[54px] shrink-0 rounded-lg bg-bg object-cover"
              />
            ) : (
              <span aria-hidden className="grid h-[72px] w-[54px] shrink-0 place-items-center rounded-lg bg-bg text-xl">
                🔗
              </span>
            )}
            <span className="flex min-w-0 flex-col justify-center">
              {preview.linkTitle && <b className="line-clamp-2 text-sm font-semibold">{preview.linkTitle}</b>}
              <small className="truncate text-xs text-muted">{linkHost(preview.linkUrl)}</small>
              <small className="text-xs font-medium text-accent">Abrir link ↗</small>
            </span>
          </a>
        )}
      </div>

      <label htmlFor="idea-body" className="sr-only">
        Texto
      </label>
      <textarea
        id="idea-body"
        ref={bodyRef}
        value={draft.body}
        maxLength={IDEA_BODY_MAX}
        placeholder="Escreva à vontade…"
        onChange={(e) => change({ body: e.target.value })}
        onBlur={() => void flush()}
        className={`mt-4 block w-full resize-none overflow-hidden text-ink placeholder:text-muted ${
          wide
            ? "min-h-[50dvh] bg-transparent px-0 py-1 text-[16px] leading-[1.7] focus:outline-none"
            : "min-h-40 rounded-2xl bg-surface px-4 py-3 leading-relaxed focus:outline-2 focus:outline-accent/40"
        }`}
      />
      {fields.body && <p className="mt-1 text-sm text-danger-ink">{fields.body}</p>}

      {bodyLinks.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-muted">Links no texto</p>
          <ul className="space-y-0.5">
            {bodyLinks.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center truncate text-sm text-accent underline underline-offset-2"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!wide && actions}

      {asking && (
        <AskSheet
          question="Concluir e apagar esta ideia?"
          detail="Ela some da pasta. Dá para desfazer por alguns segundos."
          confirmLabel="Apagar"
          onConfirm={resolve}
          onClose={() => setAsking(false)}
        />
      )}
    </section>
  );
}
