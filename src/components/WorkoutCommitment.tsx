import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { plural } from "../lib/format";
import { useWorkout } from "../lib/useWorkout";
import { showToast } from "./Toast";
import { CheckIcon, DumbbellIcon } from "./ui/Icon";

interface Props {
  /** Vai para a aba Treino (onde a sessão aberta aparece para continuar). */
  onOpenWorkout: () => void;
}

/**
 * Treino do dia como primeiro compromisso do Hoje: INICIAR, CONTINUAR (sessão aberta) ou Feito.
 * Usa só a API do Treino (GET /api/workout e POST /api/workout/sessions).
 */
export function WorkoutCommitment({ onOpenWorkout }: Props) {
  const { data, reload } = useWorkout();
  const [busy, setBusy] = useState(false);
  if (!data || (!data.todayWorkout && !data.openSession)) return null;

  const done = data.days.some((d) => d.date === data.today && d.status === "done");
  const open = data.openSession;
  const tpl = data.todayWorkout?.template;
  const name = open ? open.templateName : tpl ? (tpl.focus ? `${tpl.name} · ${tpl.focus}` : tpl.name) : "Treino";
  const count = data.todayWorkout?.exercises.length ?? 0;
  const meta = [open ? plural(open.setsDone, "série feita", "séries feitas") : plural(count, "exercício", "exercícios"), "Física"].join(" · ");

  const start = async () => {
    if (!tpl) return;
    setBusy(true);
    try {
      await api.startWorkoutSession(tpl.id);
    } catch (e) {
      // 409: já existe um treino em andamento; o Treino mostra "Continuar".
      if (!(e instanceof ApiError && e.status === 409)) {
        showToast(e instanceof ApiError ? e.message : "Não foi possível começar.");
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    void reload();
    onOpenWorkout();
  };

  const action = open ? "CONTINUAR" : "INICIAR";
  return (
    <div className="glass-quiet mb-2 flex items-center gap-3 rounded-[18px] px-3.5 py-3">
      <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-[11px] fill-neon">
        <DumbbellIcon size={18} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug font-medium break-words">{name}</p>
        <p className="font-mono text-[11px] text-muted">{meta}</p>
      </div>
      {done && !open ? (
        <span className="flex items-center gap-1 font-mono text-[12px] font-bold tracking-[0.08em] text-lime">
          <CheckIcon size={15} strokeWidth={3} />
          Feito
        </span>
      ) : (
        <button
          type="button"
          aria-label={open ? `Continuar treino: ${name}` : `Iniciar treino: ${name}`}
          disabled={busy}
          onClick={() => (open ? onOpenWorkout() : void start())}
          className="fill-brand min-h-11 shrink-0 rounded-xl px-3.5 font-mono text-[12px] font-bold tracking-[0.08em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {action}
        </button>
      )}
    </div>
  );
}
