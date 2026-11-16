import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionView } from "../../shared/workout";
import { LIVE_KEY, LiveSession } from "../components/workout/LiveSession";
import { PlanSheet } from "../components/workout/PlanSheet";
import { TodayCard } from "../components/workout/TodayCard";
import { ExerciseList } from "../components/workout/ExerciseList";
import { WorkoutWeekStrip } from "../components/workout/WeekStrip";
import { showToast } from "../components/Toast";
import { Button } from "../components/ui/Button";
import { DumbbellIcon, FlameIcon, PencilIcon, PlusIcon } from "../components/ui/Icon";
import { api, ApiError } from "../lib/api";
import { plural } from "../lib/format";
import { useWorkout } from "../lib/useWorkout";

interface Props {
  /** Botão ☰ (celular). */
  menu?: ReactNode;
  wide?: boolean;
}

/** Folha "Montar a semana" aberta (opcionalmente direto no editor de um treino). */
type Sheet = { edit: string | null } | null;

/** Aba Treino: semana fixa, treino de hoje e a montagem da semana. */
export function Workout({ menu, wide = false }: Props) {
  const { data, error, reload } = useWorkout();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  /** Treino ao vivo aberto em tela cheia. */
  const [live, setLive] = useState<{ id: string; initial: SessionView | null } | null>(null);
  const resumed = useRef(false);

  // Reabriu o app no meio do treino: volta direto para a tela do treino.
  useEffect(() => {
    if (!data || resumed.current) return;
    resumed.current = true;
    let mark: string | null = null;
    try {
      mark = localStorage.getItem(LIVE_KEY);
    } catch {
      /* sem armazenamento */
    }
    if (data.openSession && mark === data.openSession.id) setLive({ id: data.openSession.id, initial: null });
  }, [data]);

  const start = async (templateId: string) => {
    setBusy(true);
    try {
      const s = await api.startWorkoutSession(templateId);
      setLive({ id: s.id, initial: s });
    } catch (e) {
      // 409: já existe um treino em andamento; a recarga mostra "Continuar treino".
      if (!(e instanceof ApiError && e.status === 409)) showToast(e instanceof ApiError ? e.message : "Não foi possível começar.");
    } finally {
      await reload();
      setBusy(false);
    }
  };

  const view = data;
  const empty = view && view.templates.length === 0 && !view.openSession;

  return (
    <div
      className={wide ? "pane h-full px-8 pt-[22px] pb-8" : "mx-auto w-full max-w-md px-4"}
      style={
        wide
          ? undefined
          : {
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
              // Sem captura embaixo, só a barra de baixo.
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 2rem)",
            }
      }
    >
      <div className={wide ? "mx-auto max-w-xl" : undefined}>
        <div className="mb-3 flex min-h-11 items-center gap-2.5">
          {menu}
          <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <h1 className="eyebrow !text-[12px] !text-ink">Treino</h1>
            {view && <span className="eyebrow truncate">· semana {view.weekNumber}</span>}
          </div>
          {view && !empty && (
            <span
              className="glass-quiet flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[13px] font-bold text-[#ffb347]"
              aria-label={`Sequência: ${plural(view.streak, "semana seguida", "semanas seguidas")} com a meta cumprida`}
            >
              <FlameIcon size={16} fill="#ff8a1f" strokeWidth={1.6} className="drop-shadow-[0_0_6px_#ff8a1f]" aria-hidden />
              <span aria-hidden>{view.streak} sem</span>
            </span>
          )}
        </div>

        {error && !view && (
          <div role="alert" className="glass-quiet flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
            <span>{error}</span>
            <Button size="sm" onClick={() => void reload()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {!view && !error && (
          <p role="status" className="mt-6 text-center text-sm text-muted">
            Carregando treino…
          </p>
        )}

        {empty && (
          <section aria-labelledby="treino-vazio" className="glass mt-5 flex flex-col items-center rounded-[22px] px-6 py-8 text-center">
            <span aria-hidden className="grid size-12 place-items-center rounded-2xl fill-neon">
              <DumbbellIcon size={24} strokeWidth={2.2} />
            </span>
            <h2 id="treino-vazio" className="mt-4 font-display text-lg font-bold">
              Monte sua semana
            </h2>
            <p className="mt-1.5 max-w-[30ch] text-sm text-muted">
              Crie os treinos A, B e C, escolha o dia de cada um e a meta de dias por semana.
            </p>
            <Button variant="primary" className="mt-5" icon={<PlusIcon size={18} />} onClick={() => setSheet({ edit: null })}>
              Montar a semana
            </Button>
          </section>
        )}

        {view && !empty && (
          <>
            <WorkoutWeekStrip days={view.days} templates={view.templates} today={view.today} />
            <TodayCard
              view={view}
              busy={busy}
              onStart={(id) => void start(id)}
              onContinue={(id) => setLive({ id, initial: null })}
              onEditTemplate={(id) => setSheet({ edit: id })}
            />
            {view.todayWorkout && view.todayWorkout.exercises.length > 0 && (
              <ExerciseList
                exercises={view.todayWorkout.exercises}
                onEdit={() => setSheet({ edit: view.todayWorkout!.template.id })}
              />
            )}
            <Button className="mt-4 w-full" icon={<PencilIcon size={16} />} onClick={() => setSheet({ edit: null })}>
              Montar a semana
            </Button>
          </>
        )}
      </div>

      {live && view && (
        <LiveSession
          key={live.id}
          sessionId={live.id}
          initial={live.initial}
          sound={view.settings.sound}
          defaultRestS={view.settings.defaultRestS}
          onClose={() => {
            setLive(null);
            void reload();
          }}
        />
      )}

      {sheet && view && (
        <PlanSheet
          view={view}
          editTemplateId={sheet.edit}
          reload={reload}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
