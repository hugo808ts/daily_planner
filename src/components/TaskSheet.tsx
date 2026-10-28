import { useEffect, useRef, useState } from "react";
import { addDays, weekStart } from "../../shared/dates";
import { TASK_TITLE_MAX } from "../../shared/limits";
import { taskStatus } from "../../shared/status";
import type { Area, Task } from "../../shared/types";
import { api, ApiError, type MoveResult, type TaskPatch } from "../lib/api";
import { AREAS, onDay, shortDay } from "../lib/format";

interface Props {
  task: Task;
  today: string;
  now: Date;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onMoved: (result: MoveResult, from: Task) => void;
  onDeleted: (task: Task) => void;
}

type Mode = "edit" | "move";

const FIELD =
  "block w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink focus:border-accent focus:outline-none aria-invalid:border-danger";
const LABEL = "mb-1 block text-sm font-medium";

/** Folha inferior para editar, levar para outro dia ou excluir uma tarefa. */
export function TaskSheet({ task, today, now, onClose, onSaved, onMoved, onDeleted }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const status = taskStatus(task, now);
  const notDone = status === "not_done";
  const done = status === "done";

  const [mode, setMode] = useState<Mode>("edit");
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [time, setTime] = useState(task.time ?? "");
  const [area, setArea] = useState<Area | null>(task.area);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      setError(e.message);
      setFields(e.fields ?? {});
    } else {
      setError("Algo deu errado. Tente de novo.");
    }
  };

  const save = async () => {
    const patch: TaskPatch = {};
    if (title.trim() !== task.title) patch.title = title;
    // Tarefa não feita não muda de data pelo formulário: o histórico fica no dia dela.
    if (!notDone && date !== task.date) patch.date = date;
    if ((time || null) !== task.time) patch.time = time || null;
    if (area !== task.area) patch.area = area;
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      onSaved(await api.updateTask(task.id, patch));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const move = async (target: string) => {
    if (!target || target === task.date) return;
    setBusy(true);
    setError(null);
    try {
      onMoved(await api.moveTask(task.id, target), task);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    setError(null);
    try {
      await api.deleteTask(task.id);
      onDeleted(task);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const nextMonday = addDays(weekStart(today), 7);
  const moveDays = Array.from({ length: 8 }, (_, i) => addDays(today, i))
    .filter((d) => d <= nextMonday)
    .filter((d) => d !== task.date);
  const dayLabel = (d: string) =>
    d === today ? "Hoje" : d === addDays(today, 1) ? "Amanhã" : d === nextMonday ? `próx. ${shortDay(d)}` : shortDay(d);

  return (
    <dialog
      ref={dialog}
      className="sheet-dialog"
      aria-labelledby="task-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="px-5 pt-2" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="task-sheet-title" className="font-display text-xl font-semibold">
            {mode === "edit" ? "Editar tarefa" : "Levar para outro dia"}
          </h2>
          <button
            type="button"
            onClick={mode === "edit" ? onClose : () => setMode("edit")}
            className="-mr-2 rounded-xl px-3 text-sm text-muted active:bg-ink/5"
          >
            {mode === "edit" ? "Fechar" : "Voltar"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        )}

        {mode === "move" ? (
          <div>
            <p className="mb-3 text-sm text-muted">
              {notDone
                ? `“${task.title}” continua como não feita ${onDay(task.date, today)}. Uma cópia vai para o dia escolhido.`
                : `“${task.title}” muda de dia.`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {moveDays.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => void move(d)}
                  className="rounded-xl bg-accent/10 px-2 text-sm font-medium text-accent active:bg-accent/20 disabled:opacity-50"
                >
                  {dayLabel(d)}
                </button>
              ))}
            </div>
            <label htmlFor="move-other" className={`${LABEL} mt-4`}>
              Outra data
            </label>
            <input
              id="move-other"
              type="date"
              min={today}
              disabled={busy}
              onChange={(e) => void move(e.target.value)}
              className={FIELD}
            />
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="task-title" className={LABEL}>
                Título
              </label>
              <input
                id="task-title"
                value={title}
                maxLength={TASK_TITLE_MAX}
                enterKeyHint="done"
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={fields.title ? true : undefined}
                aria-describedby={fields.title ? "task-title-error" : undefined}
                className={FIELD}
              />
              {fields.title && (
                <p id="task-title-error" className="mt-1 text-sm text-danger-ink">
                  {fields.title}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              {!notDone && (
                <div className="min-w-0 flex-1">
                  <label htmlFor="task-date" className={LABEL}>
                    Dia
                  </label>
                  <input
                    id="task-date"
                    type="date"
                    value={date}
                    required
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={fields.date ? true : undefined}
                    className={FIELD}
                  />
                  {fields.date && <p className="mt-1 text-sm text-danger-ink">{fields.date}</p>}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <label htmlFor="task-time" className={LABEL}>
                  Horário <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="task-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-invalid={fields.time ? true : undefined}
                  className={FIELD}
                />
                {fields.time && <p className="mt-1 text-sm text-danger-ink">{fields.time}</p>}
              </div>
            </div>
            {notDone && (
              <p className="text-sm text-muted">
                Ficou como não feita {onDay(task.date, today)}. Para fazer em outro dia, use
                “Levar para outro dia”.
              </p>
            )}

            <fieldset>
              <legend className={LABEL}>Área</legend>
              <div role="radiogroup" aria-label="Área" className="flex flex-wrap gap-2">
                {[...AREAS, { value: null, label: "Sem área", emoji: "" }].map((a) => {
                  const on = area === a.value;
                  return (
                    <button
                      key={a.label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setArea(a.value)}
                      className={`rounded-xl px-3 text-sm transition-colors duration-150 ${
                        on ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink active:bg-ink/10"
                      }`}
                    >
                      {a.emoji && <span aria-hidden>{a.emoji} </span>}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-accent font-semibold text-white active:opacity-85 disabled:opacity-60"
            >
              Salvar
            </button>
            <div className="flex gap-2">
              {!done && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("move")}
                  className="flex-1 rounded-2xl bg-accent/10 text-sm font-semibold text-accent active:bg-accent/20"
                >
                  Levar para outro dia
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className={`flex-1 rounded-2xl text-sm font-semibold transition-colors duration-150 ${
                  confirmDelete ? "bg-danger text-white" : "bg-danger/10 text-danger-ink active:bg-danger/20"
                }`}
              >
                {confirmDelete ? "Confirmar exclusão" : "Excluir"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
