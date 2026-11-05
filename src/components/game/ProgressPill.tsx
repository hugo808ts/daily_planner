import type { ReactNode } from "react";
import type { Progress } from "../../lib/api";
import { ChevronRightIcon, ReportIcon } from "../ui/Icon";
import { Medal, MedalPlaceholder, MEDAL_LABEL } from "./Medal";

interface Props {
  /** null enquanto carrega (ou se falhar): o botão mostra só o ícone do resumo. */
  progress: Progress | null;
  onClick: () => void;
  className?: string;
}

/** Botão "Resumo da semana" compacto: medalha, nível, XP da semana e seta. */
export function ProgressPill({ progress, onClick, className = "" }: Props) {
  const label = progress
    ? `Resumo da semana — Nível ${progress.level}, ${progress.weekXp} XP, ${
        progress.medal ? `Semana em ${MEDAL_LABEL[progress.medal]}` : "Semana sem medalha"
      }`
    : "Resumo da semana";
  let body: ReactNode = <ReportIcon size={16} />;
  if (progress) {
    body = (
      <>
        {progress.medal ? <Medal tier={progress.medal} size={20} /> : <MedalPlaceholder size={20} />}
        <span data-testid="progress-pill-text" className="tabular-nums">
          Nv {progress.level} · {progress.weekXp} XP
        </span>
      </>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-10 min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface pr-2.5 pl-3 text-[13.5px] font-semibold whitespace-nowrap text-ink transition-[background-color,border-color,transform] duration-150 pointer-coarse:h-11 pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none enabled:hover:border-dot enabled:hover:bg-accent-soft/50 enabled:active:scale-[0.97] motion-reduce:enabled:active:scale-100 ${className}`}
    >
      {body}
      <ChevronRightIcon size={16} className="text-muted" />
    </button>
  );
}
