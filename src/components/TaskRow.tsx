import type { TaskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { AreaTag } from "./ui/AreaTag";
import { CheckIcon } from "./ui/Icon";

interface Props {
  task: Task;
  status: TaskStatus;
  /** "veio de ter" quando a tarefa é cópia de uma não feita. */
  origin: string | null;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

const STATUS_NOTE: Partial<Record<TaskStatus, string>> = {
  overdue: "atrasada",
  not_done: "não feita",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TaskRow({ task, status, origin, onToggle, onOpen }: Props) {
  const done = status === "done";
  const bad = status === "overdue" || status === "not_done";
  const timeText = [task.time, STATUS_NOTE[status]].filter(Boolean).join(" · ");

  return (
    <li
      data-status={status}
      className="relative -mx-4 flex items-start gap-1 border-b border-line px-4 transition-colors duration-200 last:border-b-0 hover:bg-ink/[0.025]"
    >
      {bad && <span aria-hidden className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-[3px] bg-danger" />}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Desfazer conclusão: ${task.title}` : `Marcar como feita: ${task.title}`}
        onClick={() => onToggle(task)}
        className={`group -ml-3 grid size-11 shrink-0 place-items-center rounded-xl ${FOCUS}`}
      >
        <span
          className={`grid size-5 place-items-center rounded-md border-[1.75px] transition-[background-color,border-color,transform] duration-150 group-hover:border-accent group-active:scale-90 motion-reduce:transition-none ${
            done ? "border-accent-fill bg-accent-fill" : bad ? "border-danger" : "border-muted"
          }`}
        >
          {done && <CheckIcon size={14} strokeWidth={3.2} className="text-on-accent" />}
        </span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onOpen(task)}
        className={`min-w-0 flex-1 rounded-lg py-2.5 text-left ${FOCUS}`}
      >
        <span
          className={`block text-[15px] leading-snug font-medium break-words ${
            done ? "text-muted line-through decoration-muted/70" : "text-ink"
          }`}
        >
          {task.title}
        </span>
        {(task.area || timeText || origin) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-meta text-muted">
            {task.area && <AreaTag area={task.area} muted={done} />}
            {timeText && <span className={bad ? "font-semibold text-danger-ink" : ""}>{timeText}</span>}
            {origin && <span>{origin}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
