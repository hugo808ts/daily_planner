import { formatKg, formatTonnes, isoWeekday, type SessionSummary, type SummaryExercise } from "../../../shared/workout";
import { dayMonth, plural } from "../../lib/format";
import { kgText, WEEKDAY_LONG } from "../../lib/workoutFormat";
import { Button } from "../ui/Button";
import { StarIcon } from "../ui/Icon";

interface Props {
  summary: SessionSummary;
  onClose: () => void;
}

const DELTA_CLS = {
  up: "text-lime [text-shadow:0_0_8px_rgb(136_239_27/0.6)]",
  down: "text-danger",
  same: "text-muted",
  new: "text-mint",
} as const;

function delta(e: SummaryExercise): string {
  if (e.trend === "new" || e.prevMaxG === null) return "novo";
  const d = Math.abs(e.maxG - e.prevMaxG);
  if (e.trend === "up") return `↑ ${formatKg(d)}`;
  if (e.trend === "down") return `↓ ${formatKg(d)}`;
  return "= igual";
}

const deltaLabel = (e: SummaryExercise): string =>
  e.trend === "up" ? "subiu" : e.trend === "down" ? "caiu" : e.trend === "same" ? "igual" : "primeira vez";

/** Resumo do fim do treino (tela C do rascunho): XP, volume contra a última vez, recordes e cada exercício. */
export function SessionSummaryView({ summary: s, onClose }: Props) {
  const day = `${WEEKDAY_LONG[isoWeekday(s.date) - 1]}, ${dayMonth(`${s.date}T12:00:00-03:00`)}`;
  const minutes = s.durationS !== null ? `${Math.max(1, Math.round(s.durationS / 60))} min` : null;
  const pct = s.volumeChangePct;
  return (
    <section aria-labelledby="summary-title">
      <div className="mt-3.5 text-center">
        <p className="eyebrow !text-lime">Treino concluído</p>
        <h2 id="summary-title" className="mt-1.5 font-display text-[30px] leading-tight font-extrabold tracking-[-0.04em] break-words">
          {s.templateName}
        </h2>
        <p className="mt-1 text-[13px] text-muted">{[day, minutes, plural(s.sets, "série", "séries")].filter(Boolean).join(" · ")}</p>
      </div>

      <dl className="mt-3.5 grid grid-cols-3 gap-2">
        <div className="glass-quiet flex flex-col-reverse rounded-[18px] px-2.5 pt-3 pb-2.5">
          <dt className="eyebrow !text-[10px]">XP</dt>
          <dd className="text-neon font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.05em]">+{s.xp}</dd>
        </div>
        <div className="glass-quiet flex flex-col-reverse rounded-[18px] px-2.5 pt-3 pb-2.5">
          <dt className="eyebrow !text-[10px]">
            Volume{" "}
            {pct !== null && (
              <span className={`font-bold ${pct > 0 ? DELTA_CLS.up : pct < 0 ? DELTA_CLS.down : DELTA_CLS.same}`}>
                {pct > 0 ? "↑" : pct < 0 ? "↓" : "="}
                {Math.abs(pct)}%
              </span>
            )}
          </dt>
          <dd className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.05em]">{formatTonnes(s.volumeG)}</dd>
        </div>
        <div className="glass-quiet flex flex-col-reverse rounded-[18px] px-2.5 pt-3 pb-2.5">
          <dt className="eyebrow !text-[10px]">Recordes</dt>
          <dd className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.05em] text-[#ffd34d] [text-shadow:0_0_14px_rgb(255_190_60/0.5)]">
            {s.prs}
          </dd>
        </div>
      </dl>

      <h3 className="eyebrow mx-1 mt-[18px] mb-2">Contra a última vez</h3>
      <ul aria-label="Exercícios do treino" className="glass-quiet overflow-hidden rounded-[22px]">
        {s.exercises.map((e) => (
          <li key={e.exerciseKey} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 border-line px-3.5 py-[11px] [&+&]:border-t">
            <b className="flex min-w-0 items-center gap-1.5 text-[14px] break-words">
              {e.name}
              {e.pr && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-[linear-gradient(120deg,#ffd34d,#ffb347)] px-1.5 py-px font-mono text-[9.5px] tracking-[0.08em] text-[#1b1000]">
                  <StarIcon size={10} fill="currentColor" aria-hidden /> RECORDE
                </span>
              )}
            </b>
            <span className="text-right font-mono text-[11.5px] text-muted">
              <span className="sr-only">antes </span>
              {e.prevMaxG !== null ? kgText(e.prevMaxG) : "—"}
            </span>
            <span className="text-right font-mono text-[13px] font-bold">
              <span className="sr-only">hoje </span>
              {kgText(e.maxG)}
            </span>
            <small className="text-[11px] text-muted">carga máx · {plural(e.sets, "série", "séries")}</small>
            <span />
            <span className={`text-right font-mono text-[11px] font-bold ${DELTA_CLS[e.trend]}`} aria-label={deltaLabel(e)}>
              {delta(e)}
            </span>
          </li>
        ))}
      </ul>

      <Button variant="primary" className="mt-3.5 !h-14 w-full !rounded-[18px] text-base font-extrabold" onClick={onClose}>
        Salvar e fechar
      </Button>
    </section>
  );
}
