import { useEffect, useRef, useState } from "react";
import { REST_ADJUST_S, REST_PRESETS_S } from "../../../shared/workout";
import { clockLabel, useClock } from "../../lib/workoutDevice";
import { restLabel } from "../../lib/workoutFormat";
import { Button, IconButton } from "../ui/Button";
import { CheckIcon, ChevronLeftIcon } from "../ui/Icon";

interface Props {
  /** Hora de término (ms, Date.now()). O que resta é sempre endsAt − agora. */
  endsAt: number;
  /** Duração total deste descanso (s), para o anel. */
  totalS: number;
  exerciseName: string;
  /** Descanso salvo no exercício (rest_s). */
  savedRestS: number;
  /** "série 3". */
  setLabel: string;
  next: { title: string; value: string } | null;
  sound: boolean;
  onAdjust: (deltaS: number) => void;
  onPreset: (s: number) => void;
  /** Salva a duração atual como descanso do exercício. */
  onAlways: () => Promise<void>;
  onSound: (on: boolean) => void;
  /** Pular / Já estou pronto. */
  onClose: () => void;
  /** Chegou a zero (vibra, bipa e fecha). */
  onEnd: () => void;
}

function Switch({ label, on, busy, onToggle }: { label: string; on: boolean; busy?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy || undefined}
      onClick={onToggle}
      className="glass-quiet mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="flex-1 text-muted">{label}</span>
      <i
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${
          on ? "bg-green shadow-[0_0_12px_rgb(136_239_27/0.5)]" : "bg-white/15"
        }`}
      >
        <i className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-[left] duration-150 motion-reduce:transition-none ${on ? "left-[19px]" : "left-[3px]"}`} />
      </i>
    </button>
  );
}

/** Cronômetro de descanso (tela B do rascunho): anel, ±15 s, presets, interruptores e próxima série. */
export function RestTimer(p: Props) {
  const now = useClock(true);
  const remainingMs = Math.max(0, p.endsAt - now);
  const ended = remainingMs <= 0;
  const fired = useRef(false);
  const onEnd = useRef(p.onEnd);
  onEnd.current = p.onEnd;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ended && !fired.current) {
      fired.current = true;
      onEnd.current();
    }
    if (!ended) fired.current = false;
  }, [ended]);

  const frac = p.totalS > 0 ? Math.min(1, remainingMs / (p.totalS * 1000)) : 0;
  const deg = Math.round(frac * 360);
  const always = p.totalS === p.savedRestS;
  const short = p.exerciseName.split(" ")[0];

  return (
    <section aria-labelledby="rest-title" className="flex flex-col">
      <div className="flex min-h-11 items-center gap-2.5">
        <IconButton label="Voltar para a série" variant="secondary" icon={<ChevronLeftIcon size={20} strokeWidth={2.2} />} onClick={p.onClose} />
        <h2 id="rest-title" className="eyebrow flex-1 !text-ink">
          Descanso
        </h2>
        <span className="eyebrow inline-flex items-center gap-1 !text-lime">
          {p.setLabel} <CheckIcon size={12} strokeWidth={2.8} aria-label="feita" />
        </span>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div
          className="grid size-[230px] place-items-center rounded-full drop-shadow-[0_0_18px_rgb(136_239_27/0.45)]"
          style={{ background: `conic-gradient(var(--lime), var(--green) ${deg}deg, rgb(255 255 255 / 0.07) ${deg}deg 360deg)` }}
        >
          <div className="grid size-[204px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_30%,#121612,#070807_70%)] text-center">
            <div role="timer" aria-label="Tempo de descanso restante">
              <strong className="block font-mono text-[60px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">
                {clockLabel(Math.ceil(remainingMs / 1000))}
              </strong>
              <em className="mt-1.5 block font-mono text-[10px] tracking-[0.2em] text-lime not-italic">
                {ended ? "HORA DA SÉRIE" : "DESCANSANDO"}
              </em>
              <small className="mt-1 block font-mono text-[12px] text-muted">de {restLabel(p.totalS)}</small>
            </div>
          </div>
        </div>

        <div className="mt-[18px] grid w-full grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-label={`Menos ${REST_ADJUST_S} segundos`}
            onClick={() => p.onAdjust(-REST_ADJUST_S)}
            className="min-h-12 rounded-2xl border border-line bg-white/5 font-mono text-base font-bold active:bg-white/10"
          >
            − {REST_ADJUST_S}s
          </button>
          <button
            type="button"
            aria-label={`Mais ${REST_ADJUST_S} segundos`}
            onClick={() => p.onAdjust(REST_ADJUST_S)}
            className="min-h-12 rounded-2xl border border-line bg-white/5 font-mono text-base font-bold active:bg-white/10"
          >
            + {REST_ADJUST_S}s
          </button>
        </div>
        <div role="radiogroup" aria-label="Duração do descanso" className="mt-2.5 flex w-full gap-1.5">
          {REST_PRESETS_S.map((s) => {
            const on = s === p.totalS;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => p.onPreset(s)}
                className={`min-h-11 flex-1 rounded-xl font-mono text-[12px] font-semibold ${
                  on ? "fill-neon" : "border border-line bg-white/[0.035] text-muted"
                }`}
              >
                {restLabel(s)}
              </button>
            );
          })}
        </div>
        <Switch
          label={`Usar ${restLabel(p.totalS)} sempre no ${short}`}
          on={always}
          busy={saving}
          onToggle={() => {
            if (always || saving) return;
            setSaving(true);
            void p.onAlways().finally(() => setSaving(false));
          }}
        />
        <Switch label="Vibrar e tocar som no fim" on={p.sound} onToggle={() => p.onSound(!p.sound)} />
      </div>

      {p.next && (
        <div className="glass mt-3.5 rounded-[22px] p-3.5">
          <p className="eyebrow">Próxima série</p>
          <div className="mt-1 flex items-baseline gap-2">
            <b className="min-w-0 flex-1 text-[17px] break-words">{p.next.title}</b>
            <span className="font-mono font-bold whitespace-nowrap">{p.next.value}</span>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button variant="ghost" className="!h-12" onClick={p.onClose}>
          Pular
        </Button>
        <Button variant="primary" className="!h-12 font-extrabold" onClick={p.onClose}>
          Já estou pronto
        </Button>
      </div>
    </section>
  );
}
