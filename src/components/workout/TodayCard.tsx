import { useState, type ReactNode } from "react";
import { nowParts } from "../../../shared/dates";
import { formatTonnes, type WorkoutWeekView } from "../../../shared/workout";
import { dayMonth, plural } from "../../lib/format";
import { estimateMinutes, templateHeading } from "../../lib/workoutFormat";
import { Button } from "../ui/Button";
import { CheckIcon, PlayIcon, PlusIcon } from "../ui/Icon";

interface Props {
  view: WorkoutWeekView;
  /** Pedido de começar/continuar em andamento (spinner no botão). */
  busy: boolean;
  /** Abre um treino novo (hook da Fase 5: tela do treino ao vivo). */
  onStart: (templateId: string) => void;
  /** Volta para a sessão aberta (hook da Fase 5). */
  onContinue: (sessionId: string) => void;
  /** Abre o editor neste treino (ex.: treino sem exercícios). */
  onEditTemplate: (templateId: string) => void;
}

function Kpis({ view }: { view: WorkoutWeekView }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      <div className="flex flex-col-reverse gap-1 rounded-[14px] border border-line bg-white/[0.035] p-2.5">
        <dt className="eyebrow !text-[9px] !tracking-[0.14em]">Treinos</dt>
        <dd className="text-neon font-display text-[22px] leading-none font-extrabold tracking-[-0.04em]">
          {view.done}
          <span className="text-[13px] font-semibold text-muted [text-shadow:none]">/{view.goal}</span>
        </dd>
      </div>
      <div className="flex flex-col-reverse gap-1 rounded-[14px] border border-line bg-white/[0.035] p-2.5">
        <dt className="eyebrow !text-[9px] !tracking-[0.14em]">Volume</dt>
        <dd className="font-display text-[22px] leading-none font-extrabold tracking-[-0.04em]">{formatTonnes(view.volumeG)}</dd>
      </div>
      <div className="flex flex-col-reverse gap-1 rounded-[14px] border border-line bg-white/[0.035] p-2.5">
        <dt className="eyebrow !text-[9px] !tracking-[0.14em]">XP sem.</dt>
        <dd className="font-display text-[22px] leading-none font-extrabold tracking-[-0.04em]">+{view.xp}</dd>
      </div>
    </dl>
  );
}

function Shell({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-labelledby="treino-hoje"
      className="glass relative mt-3.5 overflow-hidden rounded-[22px] p-4 after:pointer-events-none after:absolute after:-top-[60px] after:-right-[50px] after:size-[190px] after:rounded-full after:bg-[radial-gradient(rgb(136_239_27/0.2),transparent_65%)] after:content-['']"
    >
      <p className="eyebrow !text-lime">{eyebrow}</p>
      <h2 id="treino-hoje" className="mt-1.5 mb-0.5 font-display text-[26px] leading-tight font-extrabold tracking-[-0.035em] break-words">
        {title}
      </h2>
      <p className="text-[13px] text-muted">{sub}</p>
      {children}
    </section>
  );
}

/** Card "Treino de hoje": meta, volume, XP e o botão Começar / Continuar treino (ou folga). */
export function TodayCard({ view, busy, onStart, onContinue, onEditTemplate }: Props) {
  const startable = view.templates.filter((t) => t.exercises.length > 0);
  const [pick, setPick] = useState<string | null>(null);
  const picked = startable.find((t) => t.id === pick) ?? startable[0] ?? null;
  const todayDay = view.days.find((d) => d.date === view.today);

  const open = view.openSession;
  if (open) {
    return (
      <Shell
        eyebrow="Em andamento"
        title={open.templateName}
        sub={`${plural(open.setsDone, "série feita", "séries feitas")} · começou às ${nowParts(new Date(open.startedAt)).time}`}
      >
        <Kpis view={view} />
        <Button variant="primary" className="mt-3 w-full !h-12 font-extrabold" busy={busy} icon={<PlayIcon size={18} />} onClick={() => onContinue(open.id)}>
          Continuar treino
        </Button>
      </Shell>
    );
  }

  const tw = view.todayWorkout;
  if (todayDay?.status === "done") {
    return (
      <Shell eyebrow="Treino de hoje" title={tw ? templateHeading(tw.template) : "Treino feito"} sub="Feito hoje. Bom trabalho!">
        <Kpis view={view} />
        <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-lime/40 bg-accent-soft py-3 text-sm font-semibold text-lime">
          <CheckIcon size={18} strokeWidth={2.6} /> Treino concluído
        </p>
      </Shell>
    );
  }

  if (tw) {
    const ex = tw.exercises;
    const last = ex.map((e) => e.last?.date).filter((d): d is string => !!d).sort().pop();
    const sub = ex.length
      ? [plural(ex.length, "exercício", "exercícios"), `~${estimateMinutes(ex)} min`, last ? `último: ${dayMonth(`${last}T12:00:00-03:00`)}` : null]
          .filter(Boolean)
          .join(" · ")
      : "Sem exercícios ainda";
    return (
      <Shell eyebrow="Treino de hoje" title={templateHeading(tw.template)} sub={sub}>
        <Kpis view={view} />
        {ex.length ? (
          <Button
            variant="primary"
            className="mt-3 w-full !h-12 font-extrabold"
            busy={busy}
            busyLabel="Começando…"
            icon={<PlayIcon size={18} />}
            onClick={() => onStart(tw.template.id)}
          >
            Começar treino
          </Button>
        ) : (
          <Button className="mt-3 w-full" icon={<PlusIcon size={18} />} onClick={() => onEditTemplate(tw.template.id)}>
            Adicionar exercícios
          </Button>
        )}
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Hoje" title="Hoje é folga" sub="Descanse, ou escolha um treino para fazer mesmo assim.">
      <Kpis view={view} />
      {picked && (
        <>
          <div role="radiogroup" aria-label="Treino para fazer hoje" className="mt-3 flex flex-wrap gap-2">
            {startable.map((t) => {
              const on = t.id === picked.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPick(t.id)}
                  className={`no-select min-h-11 rounded-xl border px-3 text-sm transition-colors duration-150 motion-reduce:transition-none ${
                    on ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line bg-white/[0.035] text-ink hover:border-dot"
                  }`}
                >
                  {templateHeading(t)}
                </button>
              );
            })}
          </div>
          <Button className="mt-3 w-full" busy={busy} busyLabel="Começando…" icon={<PlayIcon size={18} />} onClick={() => onStart(picked.id)}>
            Treinar mesmo assim
          </Button>
        </>
      )}
    </Shell>
  );
}
