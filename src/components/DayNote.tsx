import { useEffect, useRef, useState } from "react";
import { DAY_NOTE_MAX } from "../../shared/limits";
import type { DayNote as Note } from "../../shared/types";
import { api, ApiError } from "../lib/api";

interface Props {
  date: string;
  note: Note | null;
  onSaved: (date: string, note: Note | null) => void;
}

/** Anotação fixada do dia ("📌 Levar o carregador"). Toque para editar. */
export function DayNote({ date, note, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(false);
    setError(null);
  }, [date]);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const start = () => {
    setText(note?.text ?? "");
    setError(null);
    setEditing(true);
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
        className="rounded-2xl bg-note p-3 text-note-ink"
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
          ref={field}
          value={text}
          maxLength={DAY_NOTE_MAX}
          rows={2}
          enterKeyHint="done"
          placeholder="Ex.: levar o carregador"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "day-note-error" : undefined}
          className="block w-full resize-none bg-transparent leading-snug placeholder:text-note-ink/50 focus:outline-none"
        />
        {error && (
          <p id="day-note-error" role="alert" className="mt-1 text-sm text-danger-ink">
            {error}
          </p>
        )}
        <div className="mt-2 flex items-center justify-end gap-1">
          <span className="mr-auto text-xs tabular-nums opacity-60">
            {text.length}/{DAY_NOTE_MAX}
          </span>
          <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-3 text-sm active:bg-black/5">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            aria-label="Salvar anotação"
            className="rounded-xl bg-note-ink px-4 text-sm font-semibold text-note active:opacity-80 disabled:opacity-60"
          >
            Salvar
          </button>
        </div>
      </form>
    );
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={start}
        className="w-full rounded-2xl border border-dashed border-ink/20 px-3 text-left text-sm text-muted active:bg-ink/5"
      >
        <span aria-hidden>📌 </span>Fixar uma anotação
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="day-note"
      onClick={start}
      aria-label={`Editar anotação do dia: ${note.text}`}
      className="w-full rounded-2xl bg-note px-3 py-2.5 text-left text-[15px] leading-snug whitespace-pre-wrap text-note-ink active:opacity-80"
    >
      <span aria-hidden>📌 </span>
      {note.text}
    </button>
  );
}
