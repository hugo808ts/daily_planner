import { useEffect, useRef, useState } from "react";
import { WORKOUT_TEMPLATES_MAX } from "../../../shared/limits";
import {
  isoWeekday,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
  type WorkoutPlanDay,
  type WorkoutWeekView,
} from "../../../shared/workout";
import { api, ApiError } from "../../lib/api";
import { plural } from "../../lib/format";
import { nextTemplateName, templateTitle, WEEKDAY_LONG, WEEKDAY_SHORT } from "../../lib/workoutFormat";
import { Button, IconButton } from "../ui/Button";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../ui/Icon";
import { TemplateEditor } from "./TemplateEditor";

interface Props {
  view: WorkoutWeekView;
  /** Abre direto no editor deste treino. */
  editTemplateId?: string | null;
  reload: () => Promise<void>;
  onClose: () => void;
}

const GOALS = Array.from({ length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 }, (_, i) => WEEKLY_GOAL_MIN + i);

/**
 * "Montar a semana" (folha): meta de 3 a 6 dias, o treino (ou folga) de cada dia, e os treinos A/B/C.
 * Cada troca é salva na hora; "Pronto" só fecha.
 */
export function PlanSheet({ view, editTemplateId = null, reload, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<string | null>(editTemplateId);
  const [openDay, setOpenDay] = useState<number | null>(null);
  /** Plano/meta mostrados na hora (otimista) até a semana recarregar. */
  const [plan, setPlan] = useState<WorkoutPlanDay[]>(view.plan);
  const [goal, setGoal] = useState(view.settings.weeklyGoal);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    setPlan(view.plan);
    setGoal(view.settings.weeklyGoal);
  }, [view.plan, view.settings.weeklyGoal]);

  const byId = new Map(view.templates.map((t) => [t.id, t]));
  const template = editing ? byId.get(editing) ?? null : null;
  const todayWd = isoWeekday(view.today);

  const save = async (nextPlan: WorkoutPlanDay[], nextGoal: number) => {
    const before = { plan, goal };
    setPlan(nextPlan);
    setGoal(nextGoal);
    setSaving(true);
    setError(null);
    try {
      await api.saveWorkoutPlan({
        days: nextPlan.map((d) => ({ weekday: d.weekday, templateId: d.templateId })),
        weeklyGoal: nextGoal,
      });
      await reload();
    } catch (e) {
      setPlan(before.plan);
      setGoal(before.goal);
      setError(e instanceof ApiError ? e.message : "Não foi possível salvar a semana.");
    } finally {
      setSaving(false);
    }
  };

  const pickDay = (weekday: number, templateId: string | null) => {
    setOpenDay(null);
    if (plan.find((d) => d.weekday === weekday)?.templateId === templateId) return;
    void save(
      plan.map((d) => (d.weekday === weekday ? { ...d, templateId } : d)),
      goal,
    );
  };

  const createTemplate = async () => {
    setCreating(true);
    setError(null);
    try {
      const t = await api.createWorkoutTemplate({ name: nextTemplateName(view.templates) });
      await reload();
      setEditing(t.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível criar o treino.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="sheet-dialog"
      aria-labelledby="plan-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        if (editing) setEditing(null);
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="px-4 pt-2.5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex min-h-11 items-center gap-2">
          {template ? (
            <IconButton
              label="Voltar para a semana"
              variant="secondary"
              icon={<ChevronLeftIcon size={20} strokeWidth={2.2} />}
              onClick={() => setEditing(null)}
            />
          ) : null}
          <h2 id="plan-sheet-title" className="eyebrow flex-1 !text-ink">
            {template ? `Editar ${template.name}` : "Montar a semana"}
          </h2>
          <Button variant="ghost" size="sm" className="!text-lime" onClick={onClose}>
            Pronto
          </Button>
        </div>

        {template ? (
          <div className="mt-3">
            <TemplateEditor
              key={template.id}
              template={template}
              defaultRestS={view.settings.defaultRestS}
              onChanged={reload}
              onDeleted={() => setEditing(null)}
            />
          </div>
        ) : (
          <>
            <div className="glass-quiet mt-3 rounded-2xl p-3.5">
              <p id="plan-goal-label" className="eyebrow mb-2">
                Meta da semana
              </p>
              <div role="radiogroup" aria-labelledby="plan-goal-label" className="grid grid-cols-4 gap-2">
                {GOALS.map((g) => {
                  const on = g === goal;
                  return (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={saving}
                      onClick={() => g !== goal && void save(plan, g)}
                      className={`no-select flex min-h-12 flex-col items-center justify-center rounded-xl border font-display text-lg leading-none font-extrabold transition-colors duration-150 motion-reduce:transition-none ${
                        on ? "fill-neon border-transparent" : "border-line bg-white/[0.035] text-ink hover:border-dot"
                      }`}
                    >
                      {g}
                      <small className={`mt-0.5 font-mono text-[9.5px] font-medium tracking-[0.1em] uppercase ${on ? "" : "text-muted"}`}>
                        dias
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-1 mt-4 mb-2 flex items-center justify-between">
              <h3 className="eyebrow">Dias</h3>
              <span className="eyebrow">toque para trocar</span>
            </div>
            <ul aria-label="Dias da semana de treino" className="glass-quiet overflow-hidden rounded-[22px]">
              {plan.map((d) => {
                const t = d.templateId ? byId.get(d.templateId) : undefined;
                const open = openDay === d.weekday;
                const isToday = d.weekday === todayWd;
                return (
                  <li key={d.weekday} className="border-line [&+&]:border-t">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${WEEKDAY_LONG[d.weekday - 1]}: ${t ? t.name : "folga"}. Trocar`}
                      onClick={() => setOpenDay(open ? null : d.weekday)}
                      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span className="w-10 font-mono text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                        {WEEKDAY_SHORT[d.weekday - 1]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className={`block text-[14.5px] break-words ${t ? "" : "font-semibold text-muted"}`}>
                          {t ? templateTitle(t) : "Folga"}
                        </b>
                        {t && (
                          <small className="text-[12px] text-muted">
                            {t.focus ? `${t.name} · ` : ""}
                            {plural(t.exercises.length, "exercício", "exercícios")}
                          </small>
                        )}
                      </span>
                      {isToday && (
                        <span className="rounded-md bg-green/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-mint ring-1 ring-green/55 ring-inset">
                          HOJE
                        </span>
                      )}
                      <ChevronRightIcon size={16} className={`text-muted transition-transform ${open ? "rotate-90" : ""}`} />
                    </button>
                    {open && (
                      <div
                        role="radiogroup"
                        aria-label={`Treino de ${WEEKDAY_LONG[d.weekday - 1]}`}
                        className="flex flex-wrap gap-2 px-3.5 pb-3"
                      >
                        {[null, ...view.templates.map((x) => x.id)].map((id) => {
                          const on = d.templateId === id;
                          const label = id ? byId.get(id)!.name + (byId.get(id)!.focus ? ` · ${byId.get(id)!.focus}` : "") : "Folga";
                          return (
                            <button
                              key={id ?? "folga"}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => pickDay(d.weekday, id)}
                              className={`no-select min-h-11 rounded-xl border px-3 text-sm transition-colors duration-150 motion-reduce:transition-none ${
                                on ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line bg-white/[0.035] text-ink hover:border-dot"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {view.templates.length > 0 && (
              <>
                <div className="mx-1 mt-4 mb-2 flex items-center justify-between">
                  <h3 className="eyebrow">Treinos</h3>
                  <span className="eyebrow">toque para editar</span>
                </div>
                <ul aria-label="Treinos" className="glass-quiet overflow-hidden rounded-[22px]">
                  {view.templates.map((t) => (
                    <li key={t.id} className="border-line [&+&]:border-t">
                      <button
                        type="button"
                        onClick={() => setEditing(t.id)}
                        aria-label={`Editar ${t.name}`}
                        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <b className="block text-[14.5px] break-words">{t.name}</b>
                          <small className="text-[12px] text-muted">
                            {t.focus ? `${t.focus} · ` : ""}
                            {plural(t.exercises.length, "exercício", "exercícios")}
                          </small>
                        </span>
                        <ChevronRightIcon size={16} className="text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
                {error}
              </p>
            )}

            {view.templates.length < WORKOUT_TEMPLATES_MAX && (
              <button
                type="button"
                disabled={creating}
                aria-busy={creating || undefined}
                onClick={() => void createTemplate()}
                className="mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-lime/40 bg-lime/[0.05] text-sm font-bold text-lime hover:bg-lime/10 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
              >
                <PlusIcon size={17} strokeWidth={2.4} /> Novo treino (A, B, C…)
              </button>
            )}
            <p className="mx-1 mt-3 text-[12.5px] leading-relaxed text-muted">
              Os treinos A, B, C… ficam salvos e se repetem toda semana. Toque num dia para trocar o treino ou marcar folga.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
