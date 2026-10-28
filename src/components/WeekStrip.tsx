import { weekdayShort } from "../../shared/dates";
import { taskStatus, type TaskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { dayNumber, STATUS_ORDER } from "../lib/format";

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
  if (status === "done") return on ? "bg-white" : "bg-accent";
  if (status === "pending") return on ? "bg-white/45" : "bg-dot";
  return on ? "bg-[#ffb4b6]" : "bg-danger";
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
              "flex w-11 flex-col items-center rounded-2xl pt-1.5 pb-2 text-[11px] leading-tight transition-colors duration-150",
              on ? "bg-accent text-white/80" : "text-muted active:bg-ink/5",
              isToday && !on ? "ring-1 ring-accent/50 ring-inset" : "",
            ].join(" ")}
          >
            <span>{weekdayShort(date)}</span>
            <span className={`text-base font-semibold ${on ? "text-white" : "text-ink"}`}>{dayNumber(date)}</span>
            <span aria-hidden className="mt-1 flex h-1 gap-0.5">
              {statuses.slice(0, MAX_DOTS).map((s, i) => (
                <i key={i} className={`size-1 rounded-full ${dotClass(s, on)}`} />
              ))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
