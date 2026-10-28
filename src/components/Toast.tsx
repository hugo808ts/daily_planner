import { useEffect, useSyncExternalStore } from "react";

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
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Mostra um aviso curto embaixo da tela (some em 5 s). */
export function showToast(message: string, action?: ToastAction): void {
  state = { id: ++seq, message, action };
  emit();
}

function dismiss(id: number) {
  if (state?.id === id) {
    state = null;
    emit();
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function Toast() {
  const toast = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dismiss(toast.id), DURATION_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
    >
      {toast && (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink py-1.5 pr-1.5 pl-4 text-sm text-bg shadow-lg">
          <span className="py-2">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="rounded-xl px-3 font-semibold text-[color-mix(in_srgb,var(--accent)_45%,var(--bg))] active:opacity-70"
              onClick={() => {
                toast.action?.onClick();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
