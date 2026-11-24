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
    <p data-testid="score" aria-live="polite" className="sr-only">
      {parts.map((p, i) => (
        <span key={p.text} className="block">
          <span className={p.bad ? "font-semibold text-danger-ink" : "font-semibold text-ink"}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}

/** Mostrador circular do placar (visual; o texto acessível é o ScoreText). */
export function ScoreDial({ tasks, now }: { tasks: Task[]; now: Date }) {
  const s = dayScore(tasks, now);
  if (s.total === 0) return null;
  const pct = Math.round((s.done / s.total) * 100);
  return (
    <div
      aria-hidden
      className="grid size-[84px] shrink-0 place-items-center rounded-full p-[5px]"
      style={{
        background: `conic-gradient(from 0deg, var(--green) 0%, var(--lime) ${pct}%, rgb(255 255 255 / 0.08) ${pct}% 100%)`,
        boxShadow: "0 0 22px -6px rgb(136 239 27 / 0.55)",
      }}
    >
      <div className="grid size-full place-items-center rounded-full bg-bg">
        <div className="text-center leading-none">
          <div className="font-display text-[22px] font-extrabold tracking-[-0.02em] tabular-nums">
            {s.done}/{s.total}
          </div>
          <div className="eyebrow mt-1 text-[9px]! text-lime!">feitas</div>
        </div>
      </div>
    </div>
  );
}

/** Contador do dia: quantas coisas foram feitas hoje; começa em 0 e só sobe. */
export function CountDial({ done }: { done: number }) {
  return (
    <div
      aria-label={done === 1 ? "1 feita hoje" : `${done} feitas hoje`}
      className="grid size-[84px] shrink-0 place-items-center rounded-full p-[5px]"
      style={{
        background: done > 0 ? "conic-gradient(var(--green), var(--lime), var(--green))" : "rgb(255 255 255 / 0.08)",
        boxShadow: done > 0 ? "0 0 22px -6px rgb(136 239 27 / 0.55)" : undefined,
      }}
    >
      <div className="grid size-full place-items-center rounded-full bg-bg">
        <div className="text-center leading-none">
          <div className="font-display text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">{done}</div>
          <div className="eyebrow mt-1 text-[9px]! text-lime!">{done === 1 ? "feita" : "feitas"}</div>
        </div>
      </div>
    </div>
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
            s === "done" ? "bg-lime glow-lime" : s === "pending" ? "bg-dot" : "bg-danger"
          }`}
        />
      ))}
    </div>
  );
}
