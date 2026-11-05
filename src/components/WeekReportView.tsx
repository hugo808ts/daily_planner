import { todayISO, weekdayShort, weekStart } from "../../shared/dates";
import type { ReportTask, WeekReport } from "../../shared/types";
import type { LevelInfo } from "../lib/api";
import { nextMedal, XP_BY_DIFFICULTY } from "../../shared/xp";
import { signedXp, WEEK_TITLE } from "../screens/MedalReveal";
import { LevelBar } from "./game/LevelBar";
import { Medal, MedalPlaceholder, MEDAL_LABEL } from "./game/Medal";
import { AreaTag } from "./ui/AreaTag";
import { DIFFICULTY_ORDER, DifficultyTag } from "./ui/DifficultyTag";
import { Button } from "./ui/Button";
import { ArrowRightIcon, CalendarIcon, CheckIcon } from "./ui/Icon";

const BAR_UNIT = 12; // px por tarefa
const BAR_MAX = 64;

const percentFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const CARD = "rounded-[18px] border border-line bg-surface";

/** Cabeçalho do jogo: medalha, XP da semana, comparação com a anterior e feitas por dificuldade. */
function XpHeader({ report, previousXp, level }: { report: WeekReport; previousXp?: number; level?: LevelInfo }) {
  const diff = previousXp === undefined ? null : report.xp - previousXp;
  // "faltam" só faz sentido na semana atual; nas passadas já não há o que ganhar.
  const next = report.start === weekStart(todayISO()) ? nextMedal(report.xp) : null;
  return (
    <section className={`mb-3 ${CARD} px-4 py-3.5`} data-testid="report-xp" aria-label="XP da semana">
      {level && (
        <div data-testid="report-level" className="mb-3">
          <LevelBar level={level.level} into={level.into} needed={level.needed} compact />
        </div>
      )}
      <div className="flex items-center gap-3.5">
        <span className="grid size-14 shrink-0 place-items-center">
          {report.medal ? (
            <Medal tier={report.medal} size={report.medal === "supremo" ? 44 : 56} />
          ) : (
            <MedalPlaceholder size={50} />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[19px] leading-tight font-bold text-balance">
            {report.medal ? WEEK_TITLE[report.medal] : "Semana sem medalha"} · {report.xp} XP
          </h2>
          {diff !== null && (
            <p className="mt-0.5 text-meta text-muted">
              <b className={`font-semibold tabular-nums ${diff > 0 ? "text-accent-ink" : "text-ink"}`}>{signedXp(diff)} XP</b> vs semana
              passada
            </p>
          )}
          {next && (
            <p data-testid="report-next" className="mt-0.5 text-meta text-muted">
              faltam <b className="font-semibold text-ink tabular-nums">{next.missing}</b> para {MEDAL_LABEL[next.medal]}
            </p>
          )}
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3" aria-label="Feitas por dificuldade">
        {[...DIFFICULTY_ORDER].reverse().map((d) => {
          const n = report.byDifficulty[d];
          return (
            <li key={d} className="flex flex-col items-start gap-1">
              <DifficultyTag difficulty={d} />
              <span className="text-meta text-muted">
                <b className="font-display text-[17px] font-semibold text-ink tabular-nums">{n}</b> {n === 1 ? "feita" : "feitas"} ·{" "}
                {n * XP_BY_DIFFICULTY[d]} XP
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WeekReportView({
  report,
  previousXp,
  level,
  onMove,
}: {
  report: WeekReport;
  /** XP da semana anterior, para o "vs semana passada". */
  previousXp?: number;
  /** Nível com o XP até o domingo da semana. */
  level?: LevelInfo;
  onMove: (task: ReportTask) => void;
}) {
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
      <XpHeader report={report} previousXp={previousXp} level={level} />
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
