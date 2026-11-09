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

const BAR_UNIT = 18; // px por tarefa
const BAR_MAX = 110;

const percentFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const CARD = "glass-quiet rounded-[18px]";

/** Cabeçalho do jogo: medalha, XP da semana, comparação com a anterior e feitas por dificuldade. */
function XpHeader({ report, previousXp, level }: { report: WeekReport; previousXp?: number; level?: LevelInfo }) {
  const diff = previousXp === undefined ? null : report.xp - previousXp;
  // "faltam" só faz sentido na semana atual; nas passadas já não há o que ganhar.
  const next = report.start === weekStart(todayISO()) ? nextMedal(report.xp) : null;
  const pct = next ? Math.min(100, Math.round((report.xp / (report.xp + next.missing)) * 100)) : 0;
  return (
    <section className="glass mb-3 rounded-[22px] px-4 py-4" data-testid="report-xp" aria-label="XP da semana">
      {level && (
        <div data-testid="report-level" className="mb-3">
          <LevelBar level={level.level} into={level.into} needed={level.needed} compact />
        </div>
      )}
      <div className="flex items-center gap-4">
        <span className="grid shrink-0 place-items-center" style={{ width: 110, height: 124 }}>
          {report.medal ? <Medal tier={report.medal} size={110} /> : <MedalPlaceholder size={90} />}
        </span>
        <div className="min-w-0 flex-1">
          <span className="eyebrow">Medalha da semana</span>
          <h2 className="font-display mt-1 text-[22px] leading-tight font-extrabold text-balance">
            {report.medal ? WEEK_TITLE[report.medal] : "Semana sem medalha"}
            <span className="sr-only"> · </span>
            <span className="mt-0.5 block text-[34px] leading-none font-extrabold tabular-nums">
              <span className="text-neon">{report.xp}</span> <span className="font-mono text-[13px] font-medium text-muted">XP</span>
            </span>
          </h2>
          {diff !== null && (
            <p className="mt-1.5 text-meta text-muted">
              <b className={`font-semibold tabular-nums ${diff > 0 ? "text-lime" : "text-ink"}`}>{signedXp(diff)} XP</b> vs semana
              passada
            </p>
          )}
          {next && (
            <>
              <div className="level-track mt-2 h-2 overflow-hidden rounded-full" aria-hidden="true">
                <div className="level-fill h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p data-testid="report-next" className="mt-1.5 text-meta text-muted">
                faltam <b className="font-semibold text-ink tabular-nums">{next.missing}</b> para {MEDAL_LABEL[next.medal]}
              </p>
            </>
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
  bestWeekXp,
  level,
  onMove,
}: {
  report: WeekReport;
  /** XP da semana anterior, para o "vs semana passada". */
  previousXp?: number;
  /** Recorde de XP em uma semana. */
  bestWeekXp?: number;
  /** Nível com o XP até o domingo da semana. */
  level?: LevelInfo;
  onMove: (task: ReportTask) => void;
}) {
  const stat = (n: number | string, label: string, tone: "lime" | "red" | "white") => (
    <div className={`${CARD} flex-1 px-1 py-3.5 text-center`}>
      <b
        className={`font-display block text-[30px] leading-none font-extrabold tabular-nums ${
          tone === "lime" ? "text-neon" : tone === "red" ? "text-neon-danger" : "text-ink"
        }`}
      >
        {n}
      </b>
      <small className="eyebrow mt-1.5 block text-[10px]">{label}</small>
    </div>
  );
  const empty = report.done + report.notDone === 0 && report.notDoneTasks.length === 0;
  const bestDone = Math.max(0, ...report.perDay.map((d) => d.done));
  const bestDate = bestDone > 0 ? report.perDay.find((d) => d.done === bestDone)?.date : undefined;

  return (
    <>
      <XpHeader report={report} previousXp={previousXp} level={level} />
      <div className="flex gap-2" data-testid="report-numbers">
        {stat(report.done, "feitas", "lime")}
        {stat(report.notDone, "não feitas", report.notDone > 0 ? "red" : "white")}
        {report.percent === null
          ? stat("—", "do planejado", "white")
          : stat(percentFmt.format(report.percent / 100), "do planejado", "white")}
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
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Dia a dia</h2>
              {bestWeekXp !== undefined && bestWeekXp > 0 && (
                <span className="eyebrow text-[10px]">
                  Recorde: <span className="text-lime">{bestWeekXp} XP</span>
                </span>
              )}
            </div>
            <div
              className="flex items-end gap-2 pt-5"
              style={{
                height: BAR_MAX + 44,
                backgroundImage:
                  "linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px)",
                backgroundSize: "100% 1px",
                backgroundPosition: "0 20px, 0 50%, 0 calc(100% - 22px)",
                backgroundRepeat: "no-repeat",
              }}
              role="list"
            >
              {report.perDay.map((d) => {
                const total = d.done + d.notDone;
                const height = Math.min(BAR_MAX, total * BAR_UNIT);
                const best = d.date === bestDate;
                return (
                  <div
                    key={d.date}
                    role="listitem"
                    aria-label={`${weekdayShort(d.date)}: ${d.done} feitas, ${d.notDone} não feitas`}
                    className="flex flex-1 flex-col items-center justify-end gap-1.5 font-mono text-[10px] font-medium text-muted uppercase"
                  >
                    <div className="relative w-full" style={{ height: total ? height : 4 }}>
                      {best && (
                        /* "MVP" via CSS (content): não entra no texto do item da lista. */
                        <span
                          aria-hidden="true"
                          className="text-neon absolute inset-x-0 -top-4 text-center font-mono text-[9px] font-semibold before:content-['MVP']"
                        />
                      )}
                      <div
                        className="flex h-full w-full flex-col-reverse overflow-hidden rounded-[7px_7px_3px_3px]"
                        style={{ background: d.done === 0 ? "rgb(255 255 255 / 0.1)" : undefined }}
                      >
                        {d.done > 0 && (
                          <i
                            className="block"
                            style={{
                              flex: d.done,
                              background: "linear-gradient(180deg, var(--lime), var(--green) 40%, rgb(0 132 0 / 0.35))",
                              boxShadow: "0 0 16px -2px rgb(136 239 27 / 0.55)",
                            }}
                          />
                        )}
                        {d.notDone > 0 && <i className="block bg-danger/70" style={{ flex: d.notDone }} />}
                      </div>
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
