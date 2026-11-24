import { addDays, todayISO } from "../../shared/dates";
import { taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { TaskRow } from "./TaskRow";

interface Props {
  /** Compromissos com dia = hoje (destaque laranja). */
  appointments: Task[];
  /** Sem data: pendentes e as feitas hoje (riscadas). */
  undated: Task[];
  today: string;
  now: Date;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

/** Dias inteiros desde o dia (local) em que a tarefa entrou na lista. */
export function daysOnList(task: Task, today: string): number {
  const created = todayISO(new Date(task.createdAt));
  let n = 0;
  for (let d = created; d < today && n < 3650; d = addDays(d, 1)) n++;
  return n;
}

const ageNote = (task: Task, today: string): string | null => {
  if (task.doneAt) return null;
  const n = daysOnList(task, today);
  return n > 1 ? `na lista há ${n} dias` : null;
};

/** Lista "A fazer" de hoje: compromissos do dia em cima, depois a lista sem data. */
export function TodoList({ appointments, undated, today, now, onToggle, onOpen }: Props) {
  if (appointments.length === 0 && undated.length === 0) {
    return (
      <p className="glass-quiet rounded-[18px] px-4 py-6 text-center text-sm text-muted">
        Nada na lista. Escreva embaixo o que precisa fazer.
      </p>
    );
  }
  return (
    <ul data-testid="todo-list" className="glass-quiet overflow-hidden rounded-[18px] px-4">
      {appointments.map((task) => (
        <TaskRow key={task.id} task={task} status={taskStatus(task, now)} origin={null} appointment onToggle={onToggle} onOpen={onOpen} />
      ))}
      {undated.map((task) => (
        <TaskRow key={task.id} task={task} status={taskStatus(task, now)} origin={null} note={ageNote(task, today)} onToggle={onToggle} onOpen={onOpen} />
      ))}
    </ul>
  );
}
