import type { Area } from "../../../shared/types";
import { BookOpenIcon, BriefcaseIcon, HeartIcon, type IconComponent } from "./Icon";

export interface AreaMeta {
  area: Area;
  label: string;
  /** Classe do ponto/fundo forte (bg-work…). */
  dotClass: string;
  /** Classe de texto AA (text-work-ink…). */
  textClass: string;
  /** Cor CSS para estilos inline/SVG (var(--work)…). */
  color: string;
  /** Ícone para seletores de área (nunca emoji). */
  Icon: IconComponent;
}

const META: Record<Area, AreaMeta> = {
  work: { area: "work", label: "Trabalho", dotClass: "bg-work", textClass: "text-work-ink", color: "var(--work)", Icon: BriefcaseIcon },
  school: { area: "school", label: "Faculdade", dotClass: "bg-school", textClass: "text-school-ink", color: "var(--school)", Icon: BookOpenIcon },
  personal: { area: "personal", label: "Pessoal", dotClass: "bg-personal", textClass: "text-personal-ink", color: "var(--personal)", Icon: HeartIcon },
};

/** Ordem de exibição das áreas nos seletores. */
export const AREA_ORDER: Area[] = ["work", "school", "personal"];

/** Rótulo, classes e ícone de uma área. */
export const areaMeta = (area: Area): AreaMeta => META[area];

export interface AreaTagProps {
  area: Area;
  /** Esconde o texto (fica só o ponto, com o nome para leitores de tela). */
  dotOnly?: boolean;
  /** Tarefa feita: texto em --muted em vez da cor da área. */
  muted?: boolean;
  className?: string;
}

/** Ponto colorido + nome da área (no lugar de emoji). */
export function AreaTag({ area, dotOnly = false, muted = false, className = "" }: AreaTagProps) {
  const m = META[area];
  return (
    <span
      className={`no-select inline-flex items-center gap-[5px] text-meta font-medium ${muted ? "text-muted" : m.textClass} ${className}`}
    >
      <span aria-hidden className={`size-[7px] shrink-0 rounded-full ${m.dotClass}`} />
      {dotOnly ? <span className="sr-only">{m.label}</span> : m.label}
    </span>
  );
}
