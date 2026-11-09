import type { ReactNode } from "react";
import type { Progress } from "../../lib/api";
import { ReportIcon } from "../ui/Icon";
import { Medal, MedalPlaceholder, MEDAL_LABEL } from "./Medal";

interface Props {
  /** null enquanto carrega (ou se falhar): o botão mostra só o ícone do resumo. */
  progress: Progress | null;
  onClick: () => void;
  className?: string;
}

/** "Player" do tema Neon: anel de progresso do nível, XP da semana e brasão. Abre o resumo da semana. */
export function ProgressPill({ progress, onClick, className = "" }: Props) {
  const label = progress
    ? `Resumo da semana — Nível ${progress.level}, ${progress.weekXp} XP, ${
        progress.medal ? `Semana em ${MEDAL_LABEL[progress.medal]}` : "Semana sem medalha"
      }`
    : "Resumo da semana";
  let body: ReactNode = (
    <span className="grid size-9 place-items-center text-lime">
      <ReportIcon size={18} />
    </span>
  );
  if (progress) {
    const pct = progress.needed > 0 ? Math.min(100, Math.max(0, (progress.into / progress.needed) * 100)) : 0;
    body = (
      <>
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full shadow-[0_0_14px_rgb(136_239_27/0.35)]"
          style={{ background: `conic-gradient(var(--lime) 0 ${pct}%, rgb(255 255 255 / 0.1) 0)` }}
        >
          <b className="grid size-7 place-items-center rounded-full bg-[#0c0e0c] font-mono text-[12px] font-bold text-lime tabular-nums">
            {progress.level}
          </b>
        </span>
        <span data-testid="progress-pill-text" className="flex flex-col items-start leading-tight">
          <small className="font-mono text-[10px] font-medium tracking-[0.12em] text-muted">NÍVEL</small>
          <strong className="text-[13px] font-semibold tabular-nums">
            <span className="sr-only">Nv {progress.level} · </span>
            {progress.weekXp} XP
          </strong>
        </span>
        {progress.medal ? (
          <Medal tier={progress.medal} size={30} ribbon={false} className="ml-0.5" />
        ) : (
          <span className="ml-0.5 opacity-80">
            <MedalPlaceholder size={28} />
          </span>
        )}
      </>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`glass inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full py-[4px] pr-3 pl-[4px] whitespace-nowrap text-ink transition-[filter,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none enabled:hover:brightness-125 enabled:active:scale-[0.97] motion-reduce:enabled:active:scale-100 ${className}`}
    >
      {body}
    </button>
  );
}
