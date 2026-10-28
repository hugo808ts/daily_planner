import type { TaskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { areaInfo, formatTime } from "../lib/format";

interface Props {
  task: Task;
  status: TaskStatus;
  /** "veio de ter" quando a tarefa é cópia de uma não feita. */
  origin: string | null;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

const STATUS_NOTE: Partial<Record<TaskStatus, string>> = {
  overdue: "passou do horário",
  not_done: "não feita",
};

export function TaskRow({ task, status, origin, onToggle, onOpen }: Props) {
  const done = status === "done";
  const bad = status === "overdue" || status === "not_done";
  const meta = [task.time ? formatTime(task.time) : null, STATUS_NOTE[status] ?? null, origin].filter(Boolean);

  return (
    <li
      data-status={status}
      className={`-mx-4 flex items-start gap-1 border-b border-line px-4 transition-colors duration-200 last:border-b-0 ${
        bad ? "bg-danger/8" : ""
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Marcar como feita: ${task.title}`}
        onClick={() => onToggle(task)}
        className="group -ml-3 grid size-11 shrink-0 place-items-center rounded-xl"
      >
        <span
          className={`grid size-5 place-items-center rounded-md border-[1.6px] transition-[background-color,border-color,transform] duration-150 group-active:scale-90 ${
            done ? "border-accent bg-accent" : bad ? "border-danger" : "border-ink/45"
          }`}
        >
          {done && (
            <svg viewBox="0 0 16 16" className="size-3.5 text-white" aria-hidden>
              <path
                d="M3.5 8.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 rounded-lg py-2.5 text-left"
      >
        <span
          className={`block text-[15px] leading-snug ${
            done ? "text-ink/45 line-through decoration-ink/40" : bad ? "font-medium text-danger-ink" : "text-ink"
          }`}
        >
          {task.title}
        </span>
        {(task.area || meta.length > 0) && (
          <span className={`mt-1 flex flex-wrap items-center gap-x-1.5 text-xs ${bad ? "text-danger-ink" : "text-muted"}`}>
            {task.area && (
              <span className={`rounded-md px-1.5 py-px ${bad ? "bg-danger/10" : "bg-ink/[0.06]"} ${done ? "opacity-60" : ""}`}>
                {areaInfo(task.area).emoji} {areaInfo(task.area).label}
              </span>
            )}
            {meta.length > 0 && <span>{meta.join(" · ")}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
