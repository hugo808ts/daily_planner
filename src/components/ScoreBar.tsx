import { dayScore, taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { plural, STATUS_ORDER } from "../lib/format";

/** Partes do placar do dia: "3 feitas · 2 atrasadas", ou "0 de 4" antes de começar. */
export function scoreParts(tasks: Task[], now: Date): { text: string; bad: boolean }[] {
  const s = dayScore(tasks, now);
  if (s.total === 0) return [];
  if (s.done === 0 && s.overdue === 0 && s.notDone === 0) return [{ text: `0 de ${s.total}`, bad: false }];
  const parts = [{ text: plural(s.done, "feita", "feitas"), bad: false }];
  if (s.overdue) parts.push({ text: plural(s.overdue, "atrasada", "atrasadas"), bad: true });
  if (s.notDone) parts.push({ text: plural(s.notDone, "não feita", "não feitas"), bad: true });
  return parts;
}

/** Texto do placar, com as partes vermelhas destacadas. */
export function ScoreText({ tasks, now }: { tasks: Task[]; now: Date }) {
  const parts = scoreParts(tasks, now);
  if (parts.length === 0) return null;
  return (
    <p data-testid="score" className="text-sm text-muted tabular-nums">
      {parts.map((p, i) => (
        <span key={p.text}>
          {i > 0 && " · "}
          <span className={p.bad ? "font-semibold text-danger-ink" : i === 0 ? "font-semibold text-ink" : ""}>
            {p.text}
          </span>
        </span>
      ))}
    </p>
  );
}

/** Barra com um segmento por tarefa (roxo feita, vermelho atrasada/não feita, cinza pendente). */
export function ScoreBar({ tasks, now }: { tasks: Task[]; now: Date }) {
  if (tasks.length === 0) return null;
  const statuses = tasks.map((t) => taskStatus(t, now)).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]);
  return (
    <div aria-hidden className="flex gap-[3px]">
      {statuses.map((s, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            s === "done" ? "bg-accent" : s === "pending" ? "bg-dot" : "bg-danger"
          }`}
        />
      ))}
    </div>
  );
}
