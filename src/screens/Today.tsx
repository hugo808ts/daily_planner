import { useEffect, useRef, useState } from "react";
import { addDays, formatDayTitle, isSunday, todayISO, weekDays, weekStart } from "../../shared/dates";
import type { Task } from "../../shared/types";
import { SundayCard } from "../components/SundayCard";
import { DayNote } from "../components/DayNote";
import { ScoreBar, ScoreText } from "../components/ScoreBar";
import { TaskList } from "../components/TaskList";
import { TaskSheet } from "../components/TaskSheet";
import { showToast } from "../components/Toast";
import { WeekStrip } from "../components/WeekStrip";
import { api, ApiError, type MoveResult } from "../lib/api";
import { dayPhrase, longDate } from "../lib/format";
import { useNow } from "../lib/useNow";
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

  const toggle = async (task: Task) => {
    if (toggling.current.has(task.id)) return;
    toggling.current.add(task.id);
    const done = !task.doneAt;
    setTask({ ...task, doneAt: done ? new Date().toISOString() : null });
    try {
      setTask(await api.updateTask(task.id, { done }));
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
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const onMoved = (result: MoveResult, from: Task) => {
    setTask(result.task);
    setEditing(null);
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
  };

  const onDeleted = (task: Task) => {
    removeTask(task.id);
    setEditing(null);
    showToast("Tarefa excluída");
  };

  return (
    <div className={wide ? "px-[18px] pt-4 pb-2" : "mx-auto w-full max-w-md px-4"} style={wide ? undefined : MOBILE_PAD}>
      {onOpenReport &&
        (isSunday(today) ? (
          <SundayCard onOpen={() => onOpenReport(days[0])} />
        ) : (
          <button
            type="button"
            onClick={() => onOpenReport(addDays(days[0], -7))}
            className="mb-2 -ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-accent active:bg-accent/10"
          >
            Resumo da semana passada ›
          </button>
        ))}
      <WeekStrip days={days} today={today} selected={selected} tasks={tasks} now={now} onSelect={setPicked} />

      <header className="mt-5 mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
          <ScoreText tasks={dayTasks} now={now} />
        </div>
        {relative && <p className="text-sm text-muted first-letter:uppercase">{longDate(selected)}</p>}
        <div className="mt-3">
          <ScoreBar tasks={dayTasks} now={now} />
        </div>
      </header>

      {error && !data ? (
        <div role="alert" className="rounded-[20px] bg-surface px-4 py-5 text-center text-sm">
          <p className="mb-2 text-danger-ink">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-xl bg-accent/10 px-4 font-semibold text-accent active:bg-accent/20"
          >
            Tentar de novo
          </button>
        </div>
      ) : !data ? (
        <div aria-busy="true" aria-label="Carregando" className="space-y-px overflow-hidden rounded-[20px] bg-surface px-4 py-3">
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
