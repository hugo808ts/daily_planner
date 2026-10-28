import { useEffect, useId, useRef, useState } from "react";

interface Props {
  question: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** Pergunta de confirmação (ações que apagam), numa folha inferior. */
export function AskSheet({ question, detail, confirmLabel, onConfirm, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={`${id}-q`}
      className="sheet-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="px-5 pt-2.5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
        <h2 id={`${id}-q`} className="font-display text-xl leading-snug font-semibold">
          {question}
        </h2>
        {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl bg-bg font-semibold text-ink active:bg-ink/10 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void confirm()}
            className="flex-1 rounded-2xl bg-danger font-semibold text-white active:opacity-85 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
