import type { WorkoutDay, WorkoutTemplate } from "../../../shared/workout";
import { WEEKDAY_LONG, WEEKDAY_SHORT, templateTitle } from "../../lib/workoutFormat";

interface Props {
  days: WorkoutDay[];
  templates: WorkoutTemplate[];
  today: string;
}

const STATUS_TEXT: Record<WorkoutDay["status"], string> = {
  done: "feito",
  missed: "perdido",
  today: "hoje",
  future: "planejado",
  rest: "folga",
};

/** Faixa dos 7 dias da semana fixa: treino (ou Folga) e ponto verde (feito), vermelho (perdido) ou cinza. */
export function WorkoutWeekStrip({ days, templates, today }: Props) {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return (
    <ol aria-label="Semana de treino" className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const t = d.templateId ? byId.get(d.templateId) : undefined;
        const label = t ? templateTitle(t) : d.templateName ?? "Folga";
        const isToday = d.date === today;
        const rest = !d.templateId && d.status !== "done";
        const dot =
          d.status === "done"
            ? isToday
              ? "bg-on-accent/70"
              : "bg-lime shadow-[0_0_8px_var(--lime)]"
            : d.status === "missed"
              ? "bg-danger shadow-[0_0_8px_var(--danger)]"
              : isToday
                ? "bg-black/40"
                : "bg-white/15";
        return (
          <li
            key={d.date}
            aria-current={isToday ? "date" : undefined}
            className={`flex min-w-0 flex-col items-center rounded-[14px] px-0.5 pt-2 pb-2 text-center font-mono text-[10px] tracking-[0.08em] uppercase ${
              isToday ? "fill-neon" : "border border-line bg-white/[0.03] text-muted"
            } ${rest && !isToday ? "opacity-55" : ""}`}
          >
            <span aria-hidden>{WEEKDAY_SHORT[d.weekday - 1]}</span>
            <b
              aria-hidden
              className={`mt-1 w-full truncate font-sans text-[11px] font-bold tracking-normal normal-case ${
                isToday ? "text-on-accent" : rest ? "text-muted" : "text-ink"
              }`}
            >
              {label}
            </b>
            <i aria-hidden className={`mt-1.5 size-2 rounded-full ${dot}`} />
            <span className="sr-only">
              {WEEKDAY_LONG[d.weekday - 1]}: {t || d.templateName ? (t?.name ?? d.templateName) : "folga"}, {STATUS_TEXT[d.status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
