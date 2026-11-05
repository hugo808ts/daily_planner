import { ArrowDownIcon, ArrowUpIcon, EqualIcon, type IconComponent } from "./Icon";

/** Mesmo union de shared/xp.ts (Fase 1A); manter idêntico. */
export type Difficulty = "low" | "medium" | "high";

export interface DifficultyMeta {
  difficulty: Difficulty;
  label: "Baixa" | "Média" | "Alta";
  /** Seta lucide: baixa, igual (média), alta (nunca emoji). */
  Icon: IconComponent;
  /** Classe de cor do chip (texto + fundo AA nos dois temas). */
  className: string;
}

const META: Record<Difficulty, DifficultyMeta> = {
  low: { difficulty: "low", label: "Baixa", Icon: ArrowDownIcon, className: "diff-low" },
  medium: { difficulty: "medium", label: "Média", Icon: EqualIcon, className: "diff-medium" },
  high: { difficulty: "high", label: "Alta", Icon: ArrowUpIcon, className: "diff-high" },
};

/** Ordem de exibição nos seletores. */
export const DIFFICULTY_ORDER: Difficulty[] = ["low", "medium", "high"];

/** Rótulo, ícone e classe de uma dificuldade. */
export const difficultyMeta = (d: Difficulty): DifficultyMeta => META[d];

export interface DifficultyTagProps {
  difficulty: Difficulty;
  /** Quando informado, mostra "· 25 XP" depois do rótulo. */
  xp?: number;
  className?: string;
}

/** Chip de dificuldade: seta + rótulo (+ XP). */
export function DifficultyTag({ difficulty, xp, className = "" }: DifficultyTagProps) {
  const m = META[difficulty];
  return (
    <span
      className={`no-select inline-flex items-center gap-[3px] rounded-md px-1.5 py-px text-meta font-semibold ${m.className} ${className}`}
    >
      <m.Icon size={13} strokeWidth={2.5} />
      <span>
        <span className="sr-only">Dificuldade </span>
        {m.label}
        {xp !== undefined && ` · ${xp} XP`}
      </span>
    </span>
  );
}
