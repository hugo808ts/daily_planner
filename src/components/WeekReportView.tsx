import { weekdayShort } from "../../shared/dates";
import type { ReportTask, WeekReport } from "../../shared/types";
import { AreaTag } from "./ui/AreaTag";
import { Button } from "./ui/Button";
import { ArrowRightIcon, CalendarIcon, CheckIcon } from "./ui/Icon";

const BAR_UNIT = 12; // px por tarefa
const BAR_MAX = 64;

const percentFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const CARD = "rounded-[18px] border border-line bg-surface";

export function WeekReportView({ report, onMove }: { report: WeekReport; onMove: (task: ReportTask) => void }) {
  const stat = (n: number | string, label: string, red = false) => (
    <div className="flex-1 text-center">
      <b className={`font-display block text-[28px] leading-none font-semibold tabular-nums ${red ? "text-danger-ink" : ""}`}>
        {n}
      </b>
      <small className="text-meta text-muted">{label}</small>
    </div>
  );
  const empty = report.done + report.notDone === 0 && report.notDoneTasks.length === 0;

  return (
    <>
      <div className={`flex ${CARD} px-2 py-4`} data-testid="report-numbers">
        {stat(report.done, "feitas")}
        {stat(report.notDone, "não feitas", report.notDone > 0)}
        {report.percent === null ? stat("—", "do planejado") : stat(percentFmt.format(report.percent / 100), "do planejado")}
      </div>

      {empty ? (
        <div className={`mt-3 ${CARD} px-4 py-8 text-center`}>
          <CalendarIcon size={28} className="mx-auto mb-2 text-muted" />
          <p className="font-display text-lg font-semibold">Semana sem tarefas</p>
          <p className="mt-1 text-sm text-muted">Nada foi planejado nesses dias, então não há o que resumir.</p>
        </div>
      ) : (
        <>
          <section className={`mt-3 ${CARD} px-4 py-3`}>
            <h2 className="mb-2 text-sm font-semibold">Dia a dia</h2>
            <div className="flex h-[88px] items-end gap-1.5" role="list">
              {report.perDay.map((d) => {
                const total = d.done + d.notDone;
                const height = Math.min(BAR_MAX, total * BAR_UNIT);
                return (
                  <div
                    key={d.date}
                    role="listitem"
                    aria-label={`${weekdayShort(d.date)}: ${d.done} feitas, ${d.notDone} não feitas`}
                    className="flex flex-1 flex-col items-center gap-1 text-meta text-muted"
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

          <section className={`mt-3 ${CARD} px-4 py-3`}>
            <h2 className="mb-1 text-sm font-semibold">Não feitas ({report.notDoneTasks.length})</h2>
            {report.notDoneTasks.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nada ficou para trás.</p>
            ) : (
              <ul>
                {report.notDoneTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                    <div className="min-w-0">
                      <div className="line-clamp-2 break-words">{t.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-meta text-muted">
                        <span>{weekdayShort(t.date)}</span>
                        {t.area && <AreaTag area={t.area} />}
                      </div>
                    </div>
                    {t.movedTo ? (
                      <span className="flex shrink-0 items-center gap-1 px-2 text-meta font-semibold text-muted">
                        <CheckIcon size={14} />
                        Levada
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ArrowRightIcon size={14} />}
                        aria-label={`Levar “${t.title}” para esta semana`}
                        onClick={() => onMove(t)}
                      >
                        Esta semana
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
