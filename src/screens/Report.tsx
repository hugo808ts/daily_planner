import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, isSunday, todayISO, weekStart } from "../../shared/dates";
import type { ReportTask } from "../../shared/types";
import { showToast } from "../components/Toast";
import { Button } from "../components/ui/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/ui/Icon";
import { WeekReportView } from "../components/WeekReportView";
import { api, ApiError, type ReportData } from "../lib/api";
import { dayPhrase } from "../lib/format";

const rangeFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const range = (a: string, b: string) => rangeFmt.formatRange(new Date(`${a}T12:00:00Z`), new Date(`${b}T12:00:00Z`));

interface Props {
  start: string;
  onClose: () => void;
  /** Depois de levar uma tarefa para a semana nova, para a tela Hoje recarregar. */
  onMoved?: () => void;
}

export function Report({ start: initial, onClose, onMoved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(initial);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentWeek = weekStart(todayISO());

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const load = useCallback(async (s: string) => {
    setData(null);
    setError(null);
    try {
      setData(await api.reportData(s));
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
      setData((d) =>
        d
          ? {
              ...d,
              report: {
                ...d.report,
                notDoneTasks: d.report.notDoneTasks.map((t) => (t.id === task.id ? { ...t, movedTo: true } : t)),
              },
            }
          : d,
      );
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      moving.current.delete(task.id);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Resumo da semana"
      data-toast-host
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-bg p-0 text-ink"
    >
      <div
        className="mx-auto w-full max-w-md px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
        }}
      >
        <Button variant="ghost" size="sm" icon={<ChevronLeftIcon size={18} />} className="-ml-3" onClick={onClose}>
          Voltar
        </Button>
        <h1 className="font-display mt-2 text-[28px] leading-tight font-semibold text-balance">Sua semana</h1>
        <p className="mb-3 text-sm text-muted">{range(start, addDays(start, 5))}</p>

        {error ? (
          <div role="alert" className="rounded-[18px] border border-line bg-surface px-4 py-5 text-center text-sm">
            <p className="mb-2 text-danger-ink">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void load(start)}>
              Tentar de novo
            </Button>
          </div>
        ) : !data ? (
          <div role="status" aria-busy="true" className="h-40 rounded-[18px] bg-ink/[0.04] motion-safe:animate-pulse">
            <span className="sr-only">Carregando…</span>
          </div>
        ) : (
          <WeekReportView report={data.report} previousXp={data.previousXp} level={data.level} onMove={(t) => void move(t)} />
        )}

        <div className="mt-4 flex justify-between">
          <Button variant="ghost" size="sm" icon={<ChevronLeftIcon size={18} />} onClick={() => setStart(addDays(start, -7))}>
            Semana anterior
          </Button>
          {start < currentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setStart(addDays(start, 7))}>
              Próxima
              <ChevronRightIcon size={18} />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}
