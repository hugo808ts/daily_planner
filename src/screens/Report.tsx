import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, isSunday, todayISO, weekStart } from "../../shared/dates";
import type { ReportTask, WeekReport } from "../../shared/types";
import { showToast } from "../components/Toast";
import { WeekReportView } from "../components/WeekReportView";
import { api, ApiError } from "../lib/api";
import { dayNumber, dayPhrase } from "../lib/format";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const label = (d: string) => `${dayNumber(d)} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

interface Props {
  start: string;
  onClose: () => void;
  /** Depois de levar uma tarefa para a semana nova, para a tela Hoje recarregar. */
  onMoved?: () => void;
}

export function Report({ start: initial, onClose, onMoved }: Props) {
  const [start, setStart] = useState(initial);
  const [report, setReport] = useState<WeekReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentWeek = weekStart(todayISO());

  const load = useCallback(async (s: string) => {
    setReport(null);
    setError(null);
    try {
      setReport(await api.report(s));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar o resumo.");
    }
  }, []);

  useEffect(() => {
    void load(start);
  }, [start, load]);

  /** Tarefas com "levar" em andamento: toques repetidos não criam outra cópia. */
  const moving = useRef(new Set<string>());

  const move = async (task: ReportTask) => {
    if (moving.current.has(task.id)) return;
    moving.current.add(task.id);
    // Sempre a partir de hoje (não da semana que está sendo vista); no domingo, segunda.
    const today = todayISO();
    const target = isSunday(today) ? addDays(today, 1) : today;
    try {
      await api.moveTask(task.id, target);
      showToast(`Levada para ${dayPhrase(target, today)}`);
      onMoved?.();
      setReport((r) =>
        r ? { ...r, notDoneTasks: r.notDoneTasks.map((t) => (t.id === task.id ? { ...t, movedTo: true } : t)) } : r,
      );
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      moving.current.delete(task.id);
    }
  };

  const nav = "rounded-lg px-2 py-1 text-sm font-semibold text-accent active:bg-accent/10";
  return (
    <div role="dialog" aria-label="Resumo da semana" className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div
        className="mx-auto w-full max-w-md px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
        }}
      >
        <button type="button" onClick={onClose} className={`${nav} -ml-2`}>
          ‹ voltar
        </button>
        <h1 className="font-display mt-2 text-[28px] leading-tight font-semibold">Sua semana</h1>
        <p className="mb-3 text-sm text-muted">
          {label(start)} a {label(addDays(start, 5))}
        </p>

        {error ? (
          <div role="alert" className="rounded-[20px] bg-surface px-4 py-5 text-center text-sm">
            <p className="mb-2 text-danger-ink">{error}</p>
            <button type="button" onClick={() => void load(start)} className={nav}>
              Tentar de novo
            </button>
          </div>
        ) : !report ? (
          <div aria-busy="true" aria-label="Carregando" className="h-40 rounded-[20px] bg-ink/[0.04] motion-safe:animate-pulse" />
        ) : (
          <WeekReportView report={report} onMove={(t) => void move(t)} />
        )}

        <div className="mt-4 flex justify-between">
          <button type="button" className={nav} onClick={() => setStart(addDays(start, -7))}>
            ‹ semana anterior
          </button>
          {start < currentWeek && (
            <button type="button" className={nav} onClick={() => setStart(addDays(start, 7))}>
              próxima ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
