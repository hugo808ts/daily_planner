import { useId, useState, type FormEvent } from "react";
import { EXERCISE_NAME_MAX, WORKOUT_EXERCISES_MAX, WORKOUT_FOCUS_MAX, WORKOUT_NAME_MAX } from "../../../shared/limits";
import {
  REPS_MAX,
  REST_PRESETS_S,
  SETS_MAX,
  type WorkoutExercise,
  type WorkoutExerciseCreate,
  type WorkoutTemplate,
} from "../../../shared/workout";
import { api, ApiError } from "../../lib/api";
import { plural } from "../../lib/format";
import { exerciseLine, kgText, parseKg, restLabel } from "../../lib/workoutFormat";
import { Button, IconButton } from "../ui/Button";
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, TimerIcon, TrashIcon } from "../ui/Icon";

export const FIELD =
  "block w-full min-w-0 rounded-xl border border-line bg-white/[0.035] px-3 py-2.5 text-ink focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-lime aria-invalid:border-danger";
export const LABEL = "eyebrow mb-1.5 block";
const ERROR = "mt-1 text-sm text-danger-ink";

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");

type Draft = { name: string; sets: string; reps: string; kg: string; restS: number };

const draftOf = (e?: WorkoutExercise, defaultRestS = 90): Draft =>
  e
    ? { name: e.name, sets: String(e.sets), reps: String(e.reps), kg: kgText(e.weightG), restS: e.restS }
    : { name: "", sets: "3", reps: "10", kg: "", restS: defaultRestS };

const intOf = (s: string, min: number, max: number): number | null => {
  if (!/^\s*\d{1,3}\s*$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

/** Formulário de um exercício (novo ou editando): nome, séries, reps, kg e descanso. */
function ExerciseForm({
  initial,
  defaultRestS,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: WorkoutExercise;
  defaultRestS: number;
  submitLabel: string;
  onSubmit: (input: WorkoutExerciseCreate) => Promise<void>;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [d, setD] = useState<Draft>(() => draftOf(initial, defaultRestS));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sets = intOf(d.sets, 1, SETS_MAX);
    const reps = intOf(d.reps, 1, REPS_MAX);
    const weightG = d.kg.trim() === "" ? 0 : parseKg(d.kg);
    const bad: Record<string, string> = {};
    if (!d.name.trim()) bad.name = "Informe o exercício.";
    if (sets === null) bad.sets = `De 1 a ${SETS_MAX}.`;
    if (reps === null) bad.reps = `De 1 a ${REPS_MAX}.`;
    if (weightG === null) bad.weightG = "Use kg com 0,5 de passo (ex.: 82,5).";
    setFields(bad);
    setError(null);
    if (Object.keys(bad).length) return;
    setBusy(true);
    try {
      await onSubmit({ name: d.name.trim(), sets: sets!, reps: reps!, weightG: weightG!, restS: d.restS });
      if (!initial) setD(draftOf(undefined, d.restS));
    } catch (err) {
      setError(errorText(err));
      if (err instanceof ApiError && err.fields) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  };

  const id = (n: string) => `${uid}-${n}`;
  const invalid = (n: string) =>
    fields[n] ? { "aria-invalid": true as const, "aria-describedby": id(`${n}-err`) } : {};
  const err = (n: string) =>
    fields[n] && (
      <p id={id(`${n}-err`)} className={ERROR}>
        {fields[n]}
      </p>
    );
  const rests = [...new Set([...REST_PRESETS_S, d.restS])].sort((a, b) => a - b);

  return (
    <form noValidate onSubmit={submit} className="glass-quiet rounded-2xl p-3">
      <label htmlFor={id("name")} className={LABEL}>
        Exercício
      </label>
      <input
        id={id("name")}
        name="exercise-name"
        autoComplete="off"
        value={d.name}
        maxLength={EXERCISE_NAME_MAX}
        placeholder="Ex.: Agachamento livre"
        onChange={(e) => set({ name: e.target.value })}
        className={FIELD}
        {...invalid("name")}
      />
      {err("name")}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <label htmlFor={id("sets")} className={LABEL}>
            Séries
          </label>
          <input
            id={id("sets")}
            name="sets"
            inputMode="numeric"
            autoComplete="off"
            value={d.sets}
            onChange={(e) => set({ sets: e.target.value })}
            className={`${FIELD} font-mono`}
            {...invalid("sets")}
          />
          {err("sets")}
        </div>
        <div>
          <label htmlFor={id("reps")} className={LABEL}>
            Reps
          </label>
          <input
            id={id("reps")}
            name="reps"
            inputMode="numeric"
            autoComplete="off"
            value={d.reps}
            onChange={(e) => set({ reps: e.target.value })}
            className={`${FIELD} font-mono`}
            {...invalid("reps")}
          />
          {err("reps")}
        </div>
        <div>
          <label htmlFor={id("kg")} className={LABEL}>
            Peso kg
          </label>
          <input
            id={id("kg")}
            name="weight"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={d.kg}
            onChange={(e) => set({ kg: e.target.value })}
            className={`${FIELD} font-mono`}
            {...invalid("weightG")}
          />
          {err("weightG")}
        </div>
      </div>
      <label htmlFor={id("rest")} className={`${LABEL} mt-3`}>
        Descanso
      </label>
      <select
        id={id("rest")}
        name="rest"
        value={d.restS}
        onChange={(e) => set({ restS: Number(e.target.value) })}
        className={`${FIELD} font-mono`}
      >
        {rests.map((s) => (
          <option key={s} value={s}>
            {restLabel(s)}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {onCancel && (
          <Button variant="ghost" className="flex-1" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-1" busy={busy} busyLabel="Salvando…">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  template: WorkoutTemplate;
  defaultRestS: number;
  /** Recarrega a semana depois de cada mudança (a lista vem de lá). */
  onChanged: () => Promise<void>;
  onDeleted: () => void;
}

/** Editor de um treino: nome e foco; exercícios com séries, reps, kg e descanso; mover e apagar. */
export function TemplateEditor({ template, defaultRestS, onChanged, onDeleted }: Props) {
  const uid = useId();
  const [name, setName] = useState(template.name);
  const [focus, setFocus] = useState(template.focus ?? "");
  const [headBusy, setHeadBusy] = useState(false);
  const [headError, setHeadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(template.exercises.length === 0);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ex = template.exercises;
  const headDirty = name.trim() !== template.name || focus.trim() !== (template.focus ?? "");

  const saveHead = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setHeadError("Informe um nome.");
      return;
    }
    setHeadBusy(true);
    setHeadError(null);
    try {
      await api.updateWorkoutTemplate(template.id, { name: name.trim(), focus: focus.trim() || null });
      await onChanged();
    } catch (err) {
      setHeadError(errorText(err));
    } finally {
      setHeadBusy(false);
    }
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setRowBusy(key);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRowBusy(null);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const ids = ex.map((e) => e.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    void run(`${ex[i].id}-move`, () => api.reorderWorkoutExercises(template.id, ids));
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteWorkoutTemplate(template.id);
      await onChanged();
      onDeleted();
    } catch (err) {
      setError(errorText(err));
      setDeleting(false);
    }
  };

  return (
    <div>
      <form noValidate onSubmit={saveHead} className="glass-quiet rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${uid}-name`} className={LABEL}>
              Nome
            </label>
            <input
              id={`${uid}-name`}
              name="template-name"
              autoComplete="off"
              value={name}
              maxLength={WORKOUT_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-focus`} className={LABEL}>
              Foco
            </label>
            <input
              id={`${uid}-focus`}
              name="template-focus"
              autoComplete="off"
              value={focus}
              maxLength={WORKOUT_FOCUS_MAX}
              placeholder="Ex.: Perna"
              onChange={(e) => setFocus(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        {headError && (
          <p role="alert" className={ERROR}>
            {headError}
          </p>
        )}
        {headDirty && (
          <Button type="submit" variant="primary" size="sm" className="mt-3 w-full" busy={headBusy} busyLabel="Salvando…">
            Salvar nome e foco
          </Button>
        )}
      </form>

      <div className="mx-1 mt-4 mb-2 flex items-center justify-between">
        <h3 className="eyebrow">Exercícios</h3>
        <span className="eyebrow">{plural(ex.length, "exercício", "exercícios")}</span>
      </div>

      {ex.length > 0 && (
        <ol aria-label={`Exercícios do ${template.name}`} className="glass-quiet overflow-hidden rounded-[22px]">
          {ex.map((e, i) =>
            editing === e.id ? (
              <li key={e.id} className="border-line p-2 [&+&]:border-t">
                <ExerciseForm
                  initial={e}
                  defaultRestS={defaultRestS}
                  submitLabel="Salvar exercício"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (input) => {
                    await api.updateWorkoutExercise(template.id, e.id, input);
                    await onChanged();
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={e.id} className="flex items-center gap-2 border-line py-2 pr-1.5 pl-3 [&+&]:border-t">
                <span
                  aria-hidden
                  className="grid size-[26px] shrink-0 place-items-center rounded-[9px] bg-lime/[0.08] font-mono text-[11px] font-bold text-lime ring-1 ring-lime/30 ring-inset"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold break-words">{e.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-muted">
                    {exerciseLine(e)}
                    <span className="inline-flex items-center gap-0.5">
                      <TimerIcon size={11} aria-hidden />
                      <span className="sr-only">descanso</span>
                      {restLabel(e.restS)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconButton
                    size="sm"
                    label={`Subir ${e.name}`}
                    icon={<ChevronUpIcon size={16} />}
                    disabled={i === 0 || rowBusy !== null}
                    onClick={() => move(i, -1)}
                  />
                  <IconButton
                    size="sm"
                    label={`Descer ${e.name}`}
                    icon={<ChevronDownIcon size={16} />}
                    disabled={i === ex.length - 1 || rowBusy !== null}
                    onClick={() => move(i, 1)}
                  />
                  <IconButton size="sm" label={`Editar ${e.name}`} icon={<PencilIcon size={15} />} onClick={() => setEditing(e.id)} />
                  <IconButton
                    size="sm"
                    label={`Apagar ${e.name}`}
                    icon={<TrashIcon size={15} />}
                    busy={rowBusy === `${e.id}-del`}
                    disabled={rowBusy !== null}
                    onClick={() => void run(`${e.id}-del`, () => api.deleteWorkoutExercise(template.id, e.id))}
                  />
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      )}

      <div className="mt-2.5">
        {adding ? (
          <ExerciseForm
            defaultRestS={defaultRestS}
            submitLabel="Adicionar exercício"
            onCancel={ex.length ? () => setAdding(false) : undefined}
            onSubmit={async (input) => {
              await api.createWorkoutExercise(template.id, input);
              await onChanged();
            }}
          />
        ) : (
          ex.length < WORKOUT_EXERCISES_MAX && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-lime/40 bg-lime/[0.05] text-sm font-bold text-lime hover:bg-lime/10 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <PlusIcon size={17} strokeWidth={2.4} /> Novo exercício
            </button>
          )
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        {confirmDelete ? (
          <div role="group" aria-label="Confirmar apagar treino" className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Apagar {template.name}? Os dias com ele viram folga. O histórico das séries continua.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" busy={deleting} busyLabel="Apagando…" onClick={() => void remove()}>
                Apagar treino
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full !text-danger-ink" icon={<TrashIcon size={16} />} onClick={() => setConfirmDelete(true)}>
            Apagar este treino
          </Button>
        )}
      </div>
    </div>
  );
}
