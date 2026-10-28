import { weekdayShort } from "../../shared/dates";
import { taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { TaskRow } from "./TaskRow";

interface Props {
  tasks: Task[];
  /** Todas as tarefas carregadas, para achar a original de uma cópia. */
  allTasks: Task[];
  now: Date;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

function originLabel(task: Task, allTasks: Task[]): string | null {
  if (!task.movedFromId) return null;
  const original = allTasks.find((t) => t.id === task.movedFromId);
  return original ? `veio de ${weekdayShort(original.date)}` : "veio de outro dia";
}

const CARD = "rounded-[20px] bg-surface shadow-[0_1px_2px_rgb(36_32_58/0.08)]";

export function TaskList({ tasks, allTasks, now, onToggle, onOpen }: Props) {
  if (tasks.length === 0) {
    return <p className={`${CARD} px-4 py-6 text-center text-sm text-muted`}>Nada marcado para este dia.</p>;
  }
  return (
    <ul className={`${CARD} overflow-hidden px-4`}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          status={taskStatus(task, now)}
          origin={originLabel(task, allTasks)}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
