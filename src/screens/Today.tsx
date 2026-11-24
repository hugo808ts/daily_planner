import { useEffect, useRef, useState, type ReactNode } from "react";
import { addDays, formatDayTitle, isSunday, todayISO, weekDays, weekStart } from "../../shared/dates";
import type { Task } from "../../shared/types";
import { SundayCard } from "../components/SundayCard";
import { DayNote } from "../components/DayNote";
import { ScoreBar, ScoreDial, ScoreText } from "../components/ScoreBar";
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
  /** Computador: coluna fixa à esquerda, sem captura flutuante embaixo. */
  wide?: boolean;
  /** Botão ☰ do menu lateral (celular), no começo da linha do mês. */
  menu?: ReactNode;
}

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthName = (date: string) => monthFmt.format(new Date(`${date}T12:00:00Z`));

const MOBILE_PAD = {
  paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 5.5rem)",
};

export function Today({ captured, onOpenReport, wide = false, menu }: Props) {
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
  const dayXp = dayTasks.reduce((sum, t) => sum + (t.doneAt ? XP_BY_DIFFICULTY[t.difficulty] : 0), 0);
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
        setTask(from.date ? (await api.moveTask(result.task.id, from.date)).task : await api.updateTask(result.task.id, { date: null }));
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
    const where = result.task.date ? dayPhrase(result.task.date, today) : "a lista";
    showToast(result.copied ? `Cópia criada para ${where}` : `Levada para ${where}`, {
      label: "Desfazer",
      onClick: () => void undoMove(result, from),
    });
  };

  const onSaved = (task: Task) => {
    const moved = editing && editing.date !== task.date;
    setTask(task);
    setEditing(null);
    if (moved) showToast(task.date ? `Levada para ${dayPhrase(task.date, today)}` : "Levada para a lista");
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
        <div className="flex min-w-0 items-center gap-2.5">
          {menu}
          <span className="eyebrow">{monthName(selected)}</span>
        </div>
        {onOpenReport && !wide && !isSunday(today) && (
          <ProgressPill progress={progress} onClick={() => onOpenReport(addDays(days[0], -7))} />
        )}
      </div>
      {onOpenReport && isSunday(today) && <SundayCard onOpen={() => onOpenReport(days[0])} />}
      <WeekStrip days={days} today={today} selected={selected} tasks={tasks} now={now} onSelect={setPicked} />

      <header className="glass relative mt-5 mb-4 rounded-[24px] p-4">
        {pop && <XpPop key={pop.key} amount={pop.amount} onDone={() => setPop(null)} />}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[34px] leading-none font-extrabold tracking-[-0.04em]">{title}</h1>
            {relative && <p className="mt-1.5 text-[13px] text-muted first-letter:uppercase">{longDate(selected)}</p>}
          </div>
          <ScoreDial tasks={dayTasks} now={now} />
          <ScoreText tasks={dayTasks} now={now} />
        </div>
        <div className="mt-4">
          <ScoreBar tasks={dayTasks} now={now} />
        </div>
      </header>

      {data && (
        <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
          <span className="eyebrow">Missões do dia</span>
          {dayXp > 0 && <span className="font-mono text-[12px] font-medium tracking-[0.06em] text-neon">+{dayXp} XP hoje</span>}
        </div>
      )}

      {error && !data ? (
        <div role="alert" className="glass-quiet rounded-[18px] px-4 py-5 text-center text-sm">
          <p className="mb-2 text-danger-ink">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            Tentar de novo
          </Button>
        </div>
      ) : !data ? (
        <div role="status" aria-busy="true" className="glass-quiet space-y-px overflow-hidden rounded-[18px] px-4 py-3">
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
