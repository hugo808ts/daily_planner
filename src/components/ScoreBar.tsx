import { dayScore, taskStatus } from "../../shared/status";
import type { Task } from "../../shared/types";
import { plural, STATUS_ORDER } from "../lib/format";

const NB = " ";

/** Linhas do placar: "1 de 5 feitas" e, em vermelho, "2 atrasadas" / "1 não feita". */
export function scoreParts(tasks: Task[], now: Date): { text: string; bad: boolean }[] {
  const s = dayScore(tasks, now);
  if (s.total === 0) return [];
  const nb = (t: string) => t.replaceAll(" ", NB);
  const parts = [{ text: nb(`${s.done} de ${s.total} ${s.total === 1 ? "feita" : "feitas"}`), bad: false }];
  if (s.overdue) parts.push({ text: nb(plural(s.overdue, "atrasada", "atrasadas")), bad: true });
  if (s.notDone) parts.push({ text: nb(plural(s.notDone, "não feita", "não feitas")), bad: true });
  return parts;
}

/** Texto do placar (aria-live), com as partes vermelhas destacadas. */
export function ScoreText({ tasks, now }: { tasks: Task[]; now: Date }) {
  const parts = scoreParts(tasks, now);
  return (
    <p data-testid="score" aria-live="polite" className="text-right text-[13px] leading-snug text-muted tabular-nums">
      {parts.map((p, i) => (
        <span key={p.text} className="block">
          <span className={p.bad ? "font-semibold text-danger-ink" : "font-semibold text-ink"}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}

/** Barra com um segmento por tarefa (roxo feita, vermelho atrasada/nao feita, cinza pendente). */
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
