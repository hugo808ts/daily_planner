import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui/Button";

interface Props {
  question: string;
  detail?: string;
  confirmLabel: string;
  /** Texto do botão enquanto a ação roda (padrão: "Excluindo…"). */
  busyLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** Pergunta de confirmação (ações que apagam), numa folha inferior. */
export function AskSheet({ question, detail, confirmLabel, busyLabel = "Excluindo…", onConfirm, onClose }: Props) {
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
      aria-describedby={detail ? `${id}-d` : undefined}
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
        <h2 id={`${id}-q`} className="font-display text-xl leading-snug font-semibold text-balance">
          {question}
        </h2>
        {detail && (
          <p id={`${id}-d`} className="mt-1 text-sm text-muted">
            {detail}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            busy={busy}
            busyLabel={busyLabel}
            onClick={() => void confirm()}
            className="flex-1 bg-danger-fill! enabled:hover:bg-danger-fill!"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
