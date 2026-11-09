import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./ui/Icon";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
}

const DURATION_MS = 5000;
let state: ToastState | null = null;
let seq = 0;
const queue: ToastState[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Mostra um aviso curto embaixo da tela (some em 5 s; pausa ao passar o mouse ou focar). */
export function showToast(message: string, action?: ToastAction): void {
  const next = { id: ++seq, message, action };
  // Um aviso com "Desfazer" não some antes dos 5 s: o novo espera na fila.
  if (state?.action) queue.push(next);
  else state = next;
  emit();
}

function dismiss(id: number) {
  if (state?.id === id) {
    state = queue.shift() ?? null;
    emit();
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Janela modal aberta que aceita avisos (o resumo cobre a tela toda e deixa o resto inerte). */
const toastHost = (): HTMLElement | null => document.querySelector<HTMLElement>("dialog[open][data-toast-host]");

export function Toast() {
  const toast = useSyncExternalStore(subscribe, () => state);
  const [paused, setPaused] = useState(false);

  const toastId = toast?.id;
  useEffect(() => setPaused(false), [toastId]);

  useEffect(() => {
    if (!toast || paused) return;
    const t = setTimeout(() => dismiss(toast.id), DURATION_MS);
    return () => clearTimeout(t);
  }, [toast, paused]);

  const live = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 4.75rem)" }}
    >
      {toast && (
        <div
          className="pointer-events-auto flex max-w-md items-center gap-1 glass rounded-2xl py-1 pr-1 pl-4 text-sm text-ink shadow-lg"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span className="py-2 break-words">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="ml-2 min-h-11 rounded-xl px-3 font-semibold text-lime transition-colors hover:bg-lime/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lime"
              onClick={() => {
                toast.action?.onClick();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Fechar aviso"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lime"
            onClick={() => dismiss(toast.id)}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );

  const host = toast ? toastHost() : null;
  return host ? createPortal(live, host) : live;
}
