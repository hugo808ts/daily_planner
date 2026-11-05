import { useEffect, useRef, useState } from "react";
import { addDays, weekStart } from "../../shared/dates";
import { TASK_TITLE_MAX } from "../../shared/limits";
import { taskStatus } from "../../shared/status";
import type { Area, Task } from "../../shared/types";
import { api, ApiError, type MoveResult, type TaskPatch } from "../lib/api";
import { onDay, shortDay } from "../lib/format";
import { XP_BY_DIFFICULTY } from "../../shared/xp";
import { AREA_ORDER, AreaTag } from "./ui/AreaTag";
import { DIFFICULTY_ORDER, difficultyMeta, type Difficulty } from "./ui/DifficultyTag";
import { Button } from "./ui/Button";
import { CloseIcon, TrashIcon } from "./ui/Icon";

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
  "block w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger";
const LABEL = "mb-1 block text-sm font-medium";
const AREA_OPTIONS: (Area | null)[] = [...AREA_ORDER, null];

/** Folha inferior para editar, levar para outro dia ou excluir uma tarefa. */
export function TaskSheet({ task, today, now, onClose, onSaved, onMoved, onDeleted }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const status = taskStatus(task, now);
  const notDone = status === "not_done";
  const done = status === "done";

  const [mode, setMode] = useState<Mode>("edit");
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [time, setTime] = useState(task.time ?? "");
  const [area, setArea] = useState<Area | null>(task.area);
  const [difficulty, setDifficulty] = useState<Difficulty>(task.difficulty);
  const diffBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** "Outra data": só move ao tocar em Mover (o seletor de data dispara onChange a cada giro da roda). */
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  /** "Descartar alterações?" ao tentar fechar com edições não salvas. */
  const [askDiscard, setAskDiscard] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const dirty =
    title !== task.title ||
    (!notDone && date !== task.date) ||
    time !== (task.time ?? "") ||
    area !== task.area ||
    difficulty !== task.difficulty ||
    other !== "";
  const requestClose = () => (dirty ? setAskDiscard(true) : onClose());

  const onAreaKey = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + AREA_OPTIONS.length) % AREA_OPTIONS.length;
    setArea(AREA_OPTIONS[next]);
    chips.current[next]?.focus();
  };

  const onDiffKey = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
    setDifficulty(DIFFICULTY_ORDER[next]);
    diffBtns.current[next]?.focus();
  };

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
    if (difficulty !== task.difficulty) patch.difficulty = difficulty;
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
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="px-5 pt-2" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="task-sheet-title" className="font-display text-xl font-semibold">
            {mode === "edit" ? "Editar tarefa" : "Levar para outro dia"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            icon={mode === "edit" ? <CloseIcon size={16} /> : undefined}
            className="-mr-2 text-muted"
            onClick={mode === "edit" ? requestClose : () => setMode("edit")}
          >
            {mode === "edit" ? "Fechar" : "Voltar"}
          </Button>
        </div>

        {askDiscard && (
          <div role="alert" className="mb-3 rounded-xl bg-note p-3 text-note-ink">
            <p className="mb-2 text-sm font-medium">Descartar as alterações que você fez?</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAskDiscard(false)}>
                Continuar editando
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Descartar
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        )}

        {mode === "move" ? (
          <div>
            <p className="mb-3 text-sm text-muted break-words">
              {notDone
                ? `“${task.title}” continua como não feita ${onDay(task.date, today)}. Uma cópia vai para o dia escolhido.`
                : `“${task.title}” muda de dia.`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {moveDays.map((d) => (
                <Button key={d} variant="secondary" disabled={busy} onClick={() => void move(d)} className="px-2">
                  {dayLabel(d)}
                </Button>
              ))}
            </div>
            <label htmlFor="move-other" className={`${LABEL} mt-4`}>
              Outra data
            </label>
            <div className="flex gap-2">
              <input
                id="move-other"
                name="move-other"
                autoComplete="off"
                type="date"
                min={today}
                value={other}
                disabled={busy}
                onChange={(e) => setOther(e.target.value)}
                className={`${FIELD} min-w-0 flex-1`}
              />
              <Button variant="primary" disabled={busy || !other || other === task.date} onClick={() => void move(other)}>
                Mover
              </Button>
            </div>
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
                name="title"
                autoComplete="off"
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
                    name="date"
                    autoComplete="off"
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
                  name="time"
                  autoComplete="off"
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
                Ficou como não feita {onDay(task.date, today)}. Para fazer em outro dia, use “Levar para outro dia”.
              </p>
            )}

            <fieldset>
              <legend className={LABEL}>Área</legend>
              <div role="radiogroup" aria-label="Área" className="flex flex-wrap gap-2">
                {AREA_OPTIONS.map((value, i) => {
                  const on = area === value;
                  return (
                    <button
                      key={value ?? "none"}
                      ref={(el) => {
                        chips.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setArea(value)}
                      onKeyDown={(e) => onAreaKey(e, i)}
                      className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        on
                          ? "border-accent bg-accent-soft text-ink"
                          : "border-line bg-bg text-ink hover:border-dot hover:bg-accent-soft/50"
                      }`}
                    >
                      {value ? <AreaTag area={value} className="text-ink!" /> : "Sem área"}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className={LABEL}>Dificuldade</legend>
              <div role="radiogroup" aria-label="Dificuldade" className="grid grid-cols-3 gap-2">
                {DIFFICULTY_ORDER.map((value, i) => {
                  const on = difficulty === value;
                  const m = difficultyMeta(value);
                  return (
                    <button
                      key={value}
                      ref={(el) => {
                        diffBtns.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${m.label}, ${XP_BY_DIFFICULTY[value]} XP`}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setDifficulty(value)}
                      onKeyDown={(e) => onDiffKey(e, i)}
                      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        on
                          ? "border-accent bg-accent-soft text-ink"
                          : "border-line bg-bg text-ink hover:border-dot hover:bg-accent-soft/50"
                      }`}
                    >
                      <span aria-hidden className={`inline-flex items-center gap-1 rounded-md px-1.5 py-px font-semibold ${m.className}`}>
                        <m.Icon size={14} strokeWidth={2.5} />
                        {m.label}
                      </span>
                      <span aria-hidden className="text-meta text-muted">
                        {XP_BY_DIFFICULTY[value]} XP
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Button type="submit" variant="primary" busy={busy} busyLabel="Salvando…" className="w-full">
              Salvar
            </Button>
            <div className="flex gap-2">
              {!done && (
                <Button variant="secondary" disabled={busy} onClick={() => setMode("move")} className="flex-1 px-2">
                  Levar para outro dia
                </Button>
              )}
              <Button
                variant={confirmDelete ? "primary" : "danger"}
                disabled={busy}
                icon={confirmDelete ? undefined : <TrashIcon size={16} />}
                onClick={() => void remove()}
                className={`flex-1 px-2 ${confirmDelete ? "bg-danger-fill! enabled:hover:bg-danger-fill!" : ""}`}
              >
                {confirmDelete ? "Confirmar exclusão" : "Excluir"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
