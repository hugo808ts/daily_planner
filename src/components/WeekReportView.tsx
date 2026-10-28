import { weekdayShort } from "../../shared/dates";
import type { Task, WeekReport } from "../../shared/types";
import { areaInfo } from "../lib/format";

const BAR_UNIT = 12; // px por tarefa
const BAR_MAX = 64;

export function WeekReportView({ report, onMove }: { report: WeekReport; onMove: (task: Task) => void }) {
  const stat = (n: number | string, label: string, red = false) => (
    <div className="flex-1 text-center">
      <b className={`font-display block text-[28px] leading-none font-semibold tabular-nums ${red ? "text-danger-ink" : ""}`}>
        {n}
      </b>
      <small className="text-xs text-muted">{label}</small>
    </div>
  );

  return (
    <>
      <div className="flex rounded-[20px] bg-surface px-2 py-4" data-testid="report-numbers">
        {stat(report.done, "feitas")}
        {stat(report.notDone, "não feitas", report.notDone > 0)}
        {stat(`${report.percent}%`, "do planejado")}
      </div>

      <section className="mt-3 rounded-[20px] bg-surface px-4 py-3">
        <h2 className="mb-2 text-sm font-semibold">Dia a dia</h2>
        <div className="flex h-[84px] items-end gap-1.5" role="list">
          {report.perDay.map((d) => {
            const total = d.done + d.notDone;
            const height = Math.min(BAR_MAX, total * BAR_UNIT);
            return (
              <div
                key={d.date}
                role="listitem"
                aria-label={`${weekdayShort(d.date)}: ${d.done} feitas, ${d.notDone} não feitas`}
                className="flex flex-1 flex-col items-center gap-1 text-[11px] text-muted"
              >
                <div
                  className="flex w-full flex-col-reverse overflow-hidden rounded-md bg-dot/40"
                  style={{ height: total ? height : 4 }}
                >
                  {d.done > 0 && <i className="block bg-accent" style={{ flex: d.done }} />}
                  {d.notDone > 0 && <i className="block bg-danger" style={{ flex: d.notDone }} />}
                </div>
                {weekdayShort(d.date)}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-[20px] bg-surface px-4 py-3">
        <h2 className="mb-1 text-sm font-semibold">Não feitas ({report.notDoneTasks.length})</h2>
        {report.notDoneTasks.length === 0 ? (
          <p className="py-2 text-sm text-muted">Nada ficou para trás.</p>
        ) : (
          <ul>
            {report.notDoneTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                <div className="min-w-0">
                  <div className="truncate">{t.title}</div>
                  <small className="text-xs text-muted">
                    {weekdayShort(t.date)}
                    {t.area && ` · ${areaInfo(t.area).label}`}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => onMove(t)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-accent active:bg-accent/10"
                >
                  → esta semana
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
