import { weekdayShort } from "../../shared/dates";
import { taskStatus, type TaskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { dayNumber, plural, STATUS_ORDER } from "../lib/format";

const MAX_DOTS = 4;

interface Props {
  days: string[];
  today: string;
  selected: string;
  tasks: Task[];
  now: Date;
  onSelect: (date: string) => void;
}

function dotClass(status: TaskStatus, on: boolean): string {
  if (status === "done") return on ? "bg-on-accent" : "bg-accent";
  if (status === "pending") return on ? "bg-on-accent/55" : "bg-dot";
  return on ? "bg-danger-soft" : "bg-danger";
}

/** "3 feitas, 1 atrasada" para leitores de tela (os pontinhos são só cor). */
function summary(statuses: TaskStatus[]): string {
  if (statuses.length === 0) return "sem tarefas";
  const n = (s: TaskStatus) => statuses.filter((x) => x === s).length;
  const parts: string[] = [];
  if (n("done")) parts.push(plural(n("done"), "feita", "feitas"));
  if (n("overdue")) parts.push(plural(n("overdue"), "atrasada", "atrasadas"));
  if (n("not_done")) parts.push(plural(n("not_done"), "não feita", "não feitas"));
  if (n("pending")) parts.push(plural(n("pending"), "pendente", "pendentes"));
  return parts.join(", ");
}

export function WeekStrip({ days, today, selected, tasks, now, onSelect }: Props) {
  return (
    <nav aria-label="Dias da semana" className="-mx-1 flex justify-between">
      {days.map((date) => {
        const on = date === selected;
        const statuses = tasks
          .filter((t) => t.date === date)
          .map((t) => taskStatus(t, now))
          .sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]);
        const isToday = date === today;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            aria-current={isToday ? "date" : undefined}
            aria-pressed={on}
            className={[
              "flex max-w-11 min-w-0 flex-1 flex-col items-center rounded-2xl pt-1.5 pb-2 text-[12px] leading-tight transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              on ? "bg-accent-fill text-on-accent" : "text-muted hover:bg-ink/[0.06] active:bg-ink/[0.08]",
              isToday && !on ? "ring-1 ring-accent/60 ring-inset" : "",
            ].join(" ")}
          >
            <span>{weekdayShort(date)}</span>
            <span className={`text-base font-semibold ${on ? "text-on-accent" : "text-ink"}`}>{dayNumber(date)}</span>
            <span aria-hidden className="mt-1 flex h-1 gap-0.5">
              {statuses.slice(0, MAX_DOTS).map((s, i) => (
                <i key={i} className={`size-1 rounded-full ${dotClass(s, on)}`} />
              ))}
            </span>
            <span className="sr-only">{summary(statuses)}</span>
          </button>
        );
      })}
    </nav>
  );
}
