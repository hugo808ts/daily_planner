import { useEffect, useRef, useState } from "react";
import { DAY_NOTE_MAX } from "../../shared/limits";
import type { DayNote as Note } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { Button } from "./ui/Button";
import { PinIcon } from "./ui/Icon";

interface Props {
  date: string;
  note: Note | null;
  onSaved: (date: string, note: Note | null) => void;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Anotação fixada do dia. Toque para editar. */
export function DayNote({ date, note, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Pergunta "descartar o que digitou?" depois de Esc/Cancelar com texto alterado. */
  const [askDiscard, setAskDiscard] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(false);
    setAskDiscard(false);
    setError(null);
  }, [date]);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const start = () => {
    setText(note?.text ?? "");
    setError(null);
    setAskDiscard(false);
    setEditing(true);
  };

  const dirty = text !== (note?.text ?? "");
  const cancel = () => {
    if (dirty && text.trim() !== "") return setAskDiscard(true);
    setAskDiscard(false);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      onSaved(date, await api.saveDayNote(date, text));
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? (e.fields?.text ?? e.message) : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className="rounded-2xl bg-note p-3 text-note-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="day-note-text" className="sr-only">
          Anotação do dia
        </label>
        <textarea
          id="day-note-text"
          name="day-note"
          autoComplete="off"
          ref={field}
          value={text}
          maxLength={DAY_NOTE_MAX}
          rows={2}
          enterKeyHint="done"
          placeholder="Ex.: levar o carregador…"
          onChange={(e) => {
            setText(e.target.value);
            setAskDiscard(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") cancel();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "day-note-error" : undefined}
          className="block w-full resize-none bg-transparent leading-snug placeholder:text-note-ink/60 focus:outline-none"
        />
        {error && (
          <p id="day-note-error" role="alert" className="mt-1 text-sm text-danger-ink">
            {error}
          </p>
        )}
        {askDiscard ? (
          <div role="alert" className="mt-2 flex flex-wrap items-center justify-end gap-1">
            <span className="mr-auto text-sm font-medium">Descartar o que você digitou?</span>
            <Button variant="ghost" size="sm" onClick={() => setAskDiscard(false)}>
              Continuar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAskDiscard(false);
                setEditing(false);
              }}
            >
              Descartar
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-end gap-1">
            <span className="mr-auto text-meta tabular-nums opacity-75">
              {text.length}/{DAY_NOTE_MAX}
            </span>
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" busy={saving} busyLabel="Salvando…" aria-label="Salvar anotação">
              Salvar
            </Button>
          </div>
        )}
      </form>
    );
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={start}
        className={`flex min-h-11 w-full items-center gap-2 rounded-2xl border border-dashed border-ink/25 px-3 text-left text-sm text-muted transition-colors duration-150 hover:bg-ink/[0.04] active:bg-ink/5 ${FOCUS}`}
      >
        <PinIcon size={16} />
        Fixar uma anotação
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="day-note"
      onClick={start}
      aria-label={`Editar anotação do dia: ${note.text}`}
      className={`flex w-full items-start gap-2 rounded-2xl bg-note px-3 py-2.5 text-left text-[15px] leading-snug break-words whitespace-pre-wrap text-note-ink transition-opacity hover:opacity-90 active:opacity-80 ${FOCUS}`}
    >
      <PinIcon size={16} className="mt-0.5" />
      <span className="min-w-0">{note.text}</span>
    </button>
  );
}
