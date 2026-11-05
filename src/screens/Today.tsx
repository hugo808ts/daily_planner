import { useEffect, useRef, useState } from "react";
import { addDays, formatDayTitle, isSunday, todayISO, weekDays, weekStart } from "../../shared/dates";
import type { Task } from "../../shared/types";
import { SundayCard } from "../components/SundayCard";
import { DayNote } from "../components/DayNote";
import { ScoreBar, ScoreText } from "../components/ScoreBar";
import { TaskList } from "../components/TaskList";
import { TaskSheet } from "../components/TaskSheet";
import { showToast } from "../components/Toast";
import { XP_BY_DIFFICULTY } from "../../shared/xp";
import { ProgressPill } from "../components/game/ProgressPill";
import { XpPop } from "../components/game/XpPop";
import { Button } from "../components/ui/Button";
import { WeekStrip } from "../components/WeekStrip";
import { api, ApiError, type MoveResult } from "../lib/api";
import { dayPhrase, longDate } from "../lib/format";
import { useNow } from "../lib/useNow";
import { notifyProgressChanged, useProgress } from "../lib/useProgress";
import { useWeek } from "../lib/useWeek";

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");

interface Props {
  /** Abre o resumo da semana que começou em `start`. */
  onOpenReport?: (start: string) => void;
  /** Tarefa criada pela captura rápida, para entrar na semana sem recarregar. */
  captured?: Task | null;
  /** Computador: coluna fixa à esquerda, sem barra de abas nem captura flutuante embaixo. */
  wide?: boolean;
}

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthName = (date: string) => monthFmt.format(new Date(`${date}T12:00:00Z`));

const MOBILE_PAD = {
  paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 5.5rem)",
};

export function Today({ captured, onOpenReport, wide = false }: Props) {
  const now = useNow(60_000); // estados (atrasada, não feita) recalculados a cada minuto
  const today = todayISO(now);
  const days = weekDays(weekStart(today));
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && days.includes(picked) ? picked : today;
  const { data, error, reload, setTask, removeTask, setNote } = useWeek(days[0]);
  const { progress, refresh: refreshProgress } = useProgress(days[0]);
  const [pop, setPop] = useState<{ key: number; amount: number } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  /** Tarefas com PATCH de feita/não feita em andamento: toques repetidos são ignorados. */
  const toggling = useRef(new Set<string>());

  useEffect(() => {
    if (captured) setTask(captured);
  }, [captured, setTask]);

  const tasks = data?.tasks ?? [];
  const dayTasks = tasks.filter((t) => t.date === selected);
  const note = data?.notes.find((n) => n.date === selected) ?? null;
  const title = formatDayTitle(selected, today);
  const relative = title === "Hoje" || title === "Amanhã" || title === "Ontem";

  /** Recarrega nível e medalha; avisa se o nível subiu por causa de uma tarefa feita. */
  const afterChange = async (celebrate = false) => {
    const before = progress?.level;
    const p = await refreshProgress();
    notifyProgressChanged();
    if (celebrate && p && before !== undefined && p.level > before) showToast(`Subiu para o nível ${p.level}!`);
  };

  const toggle = async (task: Task) => {
    if (toggling.current.has(task.id)) return;
    toggling.current.add(task.id);
    const done = !task.doneAt;
    setTask({ ...task, doneAt: done ? new Date().toISOString() : null });
    try {
      setTask(await api.updateTask(task.id, { done }));
      if (done) setPop({ key: Date.now(), amount: XP_BY_DIFFICULTY[task.difficulty] });
      void afterChange(done);
    } catch (e) {
      setTask(task); // volta ao estado de antes do toque
      showToast(errorMessage(e));
    } finally {
      toggling.current.delete(task.id);
    }
  };

  const undoMove = async (result: MoveResult, from: Task) => {
    try {
      if (result.copied) {
        await api.deleteTask(result.task.id);
        removeTask(result.task.id);
      } else {
        setTask((await api.moveTask(result.task.id, from.date)).task);
      }
      void afterChange();
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const onMoved = (result: MoveResult, from: Task) => {
    setTask(result.task);
    setEditing(null);
    void afterChange();
    const where = dayPhrase(result.task.date, today);
    showToast(result.copied ? `Cópia criada para ${where}` : `Levada para ${where}`, {
      label: "Desfazer",
      onClick: () => void undoMove(result, from),
    });
  };

  const onSaved = (task: Task) => {
    const moved = editing && editing.date !== task.date;
    setTask(task);
    setEditing(null);
    if (moved) showToast(`Levada para ${dayPhrase(task.date, today)}`);
    void afterChange();
  };

  const onDeleted = (task: Task) => {
    removeTask(task.id);
    setEditing(null);
    showToast("Tarefa excluída");
    void afterChange();
  };

  return (
    <div className={wide ? "px-[18px] pt-4 pb-2" : "mx-auto w-full max-w-md px-4"} style={wide ? undefined : MOBILE_PAD}>
      <div className="mb-1 flex min-h-11 items-center justify-between gap-3">
        <span className="font-display text-base font-semibold text-ink capitalize">{monthName(selected)}</span>
        {onOpenReport && !wide && !isSunday(today) && (
          <ProgressPill progress={progress} onClick={() => onOpenReport(addDays(days[0], -7))} />
        )}
      </div>
      {onOpenReport && isSunday(today) && <SundayCard onOpen={() => onOpenReport(days[0])} />}
      <WeekStrip days={days} today={today} selected={selected} tasks={tasks} now={now} onSelect={setPicked} />

      <header className="relative mt-5 mb-3">
        {pop && <XpPop key={pop.key} amount={pop.amount} onDone={() => setPop(null)} />}
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
          <ScoreText tasks={dayTasks} now={now} />
        </div>
        {relative && <p className="mt-1 text-[13px] text-muted first-letter:uppercase">{longDate(selected)}</p>}
        <div className="mt-3">
          <ScoreBar tasks={dayTasks} now={now} />
        </div>
      </header>

      {error && !data ? (
        <div role="alert" className="rounded-[18px] border border-line bg-surface px-4 py-5 text-center text-sm">
          <p className="mb-2 text-danger-ink">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            Tentar de novo
          </Button>
        </div>
      ) : !data ? (
        <div role="status" aria-busy="true" className="space-y-px overflow-hidden rounded-[18px] border border-line bg-surface px-4 py-3">
          <span className="sr-only">Carregando…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 rounded-lg bg-ink/[0.04] motion-safe:animate-pulse" />
          ))}
        </div>
      ) : (
        <TaskList tasks={dayTasks} allTasks={tasks} now={now} onToggle={(t) => void toggle(t)} onOpen={setEditing} />
      )}

      {data && (
        <div className="mt-3">
          <DayNote key={selected} date={selected} note={note} onSaved={setNote} />
        </div>
      )}

      {editing && (
        <TaskSheet
          key={editing.id}
          task={editing}
          today={today}
          now={now}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onMoved={onMoved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
