import { useEffect, useState, type ReactNode } from "react";
import { addDays } from "../../../shared/dates";
import {
  formatKg,
  formatTonnes,
  isoWeekNumber,
  type AchievementId,
  type ReportExercise,
  type WorkoutReportResponse,
  type WorkoutWeekView,
} from "../../../shared/workout";
import { api, ApiError } from "../../lib/api";
import { plural } from "../../lib/format";
import { Medal, MEDAL_LABEL, MedalPlaceholder } from "../game/Medal";
import { Button } from "../ui/Button";
import {
  CheckIcon,
  ClockIcon,
  DumbbellIcon,
  FlameIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
} from "../ui/Icon";

interface Props {
  view: WorkoutWeekView;
  /** Muda quando um treino termina: recarrega o relatório. */
  refreshKey: number;
}

const ACH_ICON: Record<AchievementId, ReactNode> = {
  constante: <FlameIcon size={22} aria-hidden />,
  inquebravel: <TrophyIcon size={22} aria-hidden />,
  recordista: <StarIcon size={22} aria-hidden />,
  tonelada: <DumbbellIcon size={22} aria-hidden />,
  semana_perfeita: <CheckIcon size={22} aria-hidden />,
  madrugador: <ClockIcon size={22} aria-hidden />,
};

/** Rótulo curto no cartão (a dica completa fica no aria-label). */
const ACH_SHORT: Record<AchievementId, string> = {
  constante: "4 semanas",
  inquebravel: "12 semanas",
  recordista: "1º recorde",
  tonelada: "10t num dia",
  semana_perfeita: "dias no dia",
  madrugador: "treino < 7h",
};

const UP = "text-lime [text-shadow:0_0_8px_rgb(136_239_27/0.6)]";

function deltaText(e: ReportExercise): { text: string; cls: string; label: string } {
  if (e.deltaG === null) return { text: "novo", cls: "text-mint", label: "sem semana anterior" };
  if (e.deltaG > 0) return { text: `↑ ${formatKg(e.deltaG)}`, cls: UP, label: `subiu ${formatKg(e.deltaG)}` };
  if (e.deltaG < 0) return { text: `↓ ${formatKg(-e.deltaG)}`, cls: "text-danger", label: `caiu ${formatKg(-e.deltaG)}` };
  return { text: "= igual", cls: "text-muted", label: "igual" };
}

/** Mini gráfico de 6 semanas (barras CSS): a semana escolhida acesa. */
function Spark({ history }: { history: ReportExercise["history"] }) {
  const max = Math.max(1, ...history.map((h) => h.maxG ?? 0));
  return (
    <span aria-hidden className="flex h-[26px] items-end gap-[3px]">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        return (
          <i
            key={h.week}
            className={`w-[5px] rounded-[2px] ${last ? "bg-lime shadow-[0_0_6px_var(--lime)]" : "bg-white/20"}`}
            style={{ height: h.maxG ? `${Math.max(12, Math.round((h.maxG / max) * 100))}%` : "2px" }}
          />
        );
      })}
    </span>
  );
}

/** Progresso do treino (tela 4 e tela D dos rascunhos): brasão da semana, conquistas e relatório semana × semana. */
export function WorkoutProgress({ view, refreshKey }: Props) {
  const weeks = [0, 1, 2, 3].map((i) => addDays(view.week, -7 * i)).reverse();
  const [week, setWeek] = useState(view.week);
  const [data, setData] = useState<WorkoutReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .workoutReport(week)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Não foi possível carregar o relatório."));
    return () => {
      alive = false;
    };
  }, [week, refreshKey, tries]);

  const next = view.nextMedal;
  const nextText = next
    ? next.missingWorkouts > 0
      ? `falta ${next.missingWorkouts} p/ ${MEDAL_LABEL[next.medal]}`
      : next.missingPrs > 0
        ? `${plural(next.missingPrs, "recorde", "recordes")} p/ ${MEDAL_LABEL[next.medal]}`
        : null
    : "brasão máximo";
  const unlocked = data?.achievements.filter((a) => a.unlocked).length ?? 0;
  const r = data?.report;
  const pct = r?.volumeChangePct ?? null;

  return (
    <>
      <section aria-labelledby="treino-progresso" className="mt-6">
        <h2 id="treino-progresso" className="eyebrow mx-1 mb-2">
          Progresso
        </h2>
        <div className="glass flex items-center gap-4 rounded-[22px] p-4">
          {view.medal ? <Medal tier={view.medal} size={92} glow /> : <MedalPlaceholder size={92} />}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Brasão da semana</p>
            <p className="mt-1 font-display text-[22px] leading-tight font-extrabold tracking-[-0.03em]">
              {view.medal ? MEDAL_LABEL[view.medal] : "Sem brasão ainda"}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {view.done} de {plural(view.goal, "treino", "treinos")}
              {nextText ? ` · ${nextText}` : ""}
            </p>
            <p className="text-neon mt-1.5 font-display text-[26px] leading-none font-extrabold tracking-[-0.04em]">
              {view.xp}
              <small className="ml-1 font-mono text-[11px] font-semibold tracking-[0.1em] text-muted [text-shadow:none]">XP</small>
            </p>
          </div>
        </div>

        <dl className="mt-2.5 grid grid-cols-3 gap-2">
          <Stat label="Sem. seguidas" value={String(data?.stats.streak ?? view.streak)} hl />
          <Stat label="Recordes" value={data ? String(data.stats.totalPrs) : "–"} />
          <Stat label="Volume mês" value={data ? formatTonnes(data.stats.monthVolumeG) : "–"} />
        </dl>

        {data && (
          <>
            <div className="mx-1 mt-4 mb-2 flex items-center justify-between">
              <h3 className="eyebrow">Conquistas</h3>
              <span className="eyebrow">
                {unlocked} / {data.achievements.length}
              </span>
            </div>
            <ul aria-label="Conquistas" className="grid grid-cols-3 gap-2">
              {data.achievements.map((a) => (
                <li
                  key={a.id}
                  aria-label={`${a.label}: ${a.hint}. ${a.unlocked ? "Conquistada" : "Bloqueada"}`}
                  className={`glass-quiet flex flex-col items-center gap-1 rounded-[18px] px-2 py-3 text-center ${
                    a.unlocked ? "text-lime" : "opacity-40 grayscale"
                  }`}
                >
                  <span className={a.unlocked ? "drop-shadow-[0_0_6px_rgb(136_239_27/0.7)]" : "text-muted"}>{ACH_ICON[a.id]}</span>
                  <b className="text-[12.5px] leading-tight text-ink">{a.label}</b>
                  <span className="font-mono text-[9.5px] leading-tight tracking-[0.06em] text-muted uppercase">{ACH_SHORT[a.id]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="treino-relatorio" className="mt-6">
        <h2 id="treino-relatorio" className="eyebrow mx-1 mb-2">
          Relatório de treino
        </h2>
        <div role="radiogroup" aria-label="Semana do relatório" className="flex gap-1.5">
          {weeks.map((w) => {
            const on = w === week;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setWeek(w)}
                className={`min-h-11 flex-1 rounded-xl font-mono text-[11px] font-semibold ${
                  on ? "bg-lime/[0.08] text-ink ring-1 ring-lime/55 ring-inset" : "bg-white/[0.035] text-muted ring-1 ring-line ring-inset"
                }`}
              >
                sem {isoWeekNumber(w)}
              </button>
            );
          })}
        </div>

        {error && (
          <div role="alert" className="glass-quiet mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
            <span>{error}</span>
            <Button size="sm" onClick={() => setTries((n) => n + 1)}>
              Tentar de novo
            </Button>
          </div>
        )}

        {r && (
          <>
            <div className="glass mt-3 rounded-[22px] p-4">
              <p className="eyebrow">Evolução da semana</p>
              {r.compared > 0 ? (
                <p className="text-neon mt-1.5 font-display text-[34px] leading-none font-extrabold tracking-[-0.05em]">
                  {r.improved}
                  <small className="ml-2 font-mono text-[11px] font-semibold tracking-[0.1em] text-muted uppercase [text-shadow:none]">
                    de {r.compared} subiram
                  </small>
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-muted">
                  {r.exercises.length ? "Sem semana anterior para comparar." : "Nenhum treino concluído nesta semana."}
                </p>
              )}
              {pct !== null && (
                <p className="mt-2 text-[13px] text-muted">
                  volume{" "}
                  <b className={pct > 0 ? UP : pct < 0 ? "text-danger" : "text-ink"}>
                    {pct > 0 ? "↑" : pct < 0 ? "↓" : "="} {Math.abs(pct)}%
                  </b>{" "}
                  vs sem {isoWeekNumber(r.previousWeek)} · {formatTonnes(r.volumeG)}
                </p>
              )}
            </div>

            {r.exercises.length > 0 && (
              <>
                <div className="mx-1 mt-4 mb-2 flex items-center justify-between">
                  <h3 className="eyebrow">Por exercício · carga máx</h3>
                  <span className="eyebrow">6 sem</span>
                </div>
                <ul aria-label="Carga por exercício" className="glass-quiet overflow-hidden rounded-[22px]">
                  {r.exercises.map((e) => {
                    const d = deltaText(e);
                    return (
                      <li key={e.exerciseKey} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 border-line px-3.5 py-[11px] [&+&]:border-t">
                        <b className="min-w-0 text-[14px] break-words">{e.name}</b>
                        <Spark history={e.history} />
                        <span className="text-right font-mono text-[13px] font-bold">{formatKg(e.maxG)}</span>
                        <small className="text-[11px] text-muted">
                          {e.stagnantWeeks >= 3 ? `parado há ${e.stagnantWeeks} sem` : "carga máx"}
                        </small>
                        <span />
                        <span className={`text-right font-mono text-[11px] font-bold ${d.cls}`} aria-label={d.label}>
                          {d.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {r.tip && (
              <p className="glass-quiet mt-3 flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed">
                <SparklesIcon size={18} className="mt-0.5 shrink-0 text-lime" aria-hidden />
                <span>{r.tip.text}</span>
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, hl = false }: { label: string; value: string; hl?: boolean }) {
  return (
    <div className="glass-quiet flex flex-col-reverse rounded-[18px] px-2.5 pt-3 pb-2.5">
      <dt className="eyebrow !text-[10px]">{label}</dt>
      <dd className={`font-display text-[26px] leading-[1.05] font-extrabold tracking-[-0.05em] ${hl ? "text-neon" : ""}`}>{value}</dd>
    </div>
  );
}
