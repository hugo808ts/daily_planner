import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { SpinnerIcon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Cores por variante. `hover:` no Tailwind 4 só vale com @media (hover:hover). */
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent-fill text-on-accent enabled:hover:bg-[color-mix(in_oklab,var(--accent-fill)_86%,black)]",
  secondary: "border border-line bg-surface text-ink enabled:hover:border-dot enabled:hover:bg-accent-soft/50",
  ghost: "bg-transparent text-ink enabled:hover:bg-ink/[0.06]",
  danger: "border border-danger-line bg-transparent text-danger-ink enabled:hover:bg-danger-soft",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const MOTION = "transition-[background-color,border-color,color,transform] duration-150 motion-reduce:transition-none";

function stateClasses(disabled: boolean, busy: boolean) {
  if (busy) return "cursor-progress";
  if (disabled) return "cursor-not-allowed opacity-50";
  return "enabled:active:scale-[0.97] motion-reduce:enabled:active:scale-100";
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** md = 44 px (padrão); sm = 40 px com mouse, 44 px no toque. */
  size?: "sm" | "md";
  /** Ícone à esquerda do texto (ex.: <PlusIcon size={18} />). */
  icon?: ReactNode;
  /** Mostra spinner, desabilita cliques e marca aria-busy. */
  busy?: boolean;
  /** Texto enquanto `busy` (ex.: "Salvando…"). Sem ele, mantém o texto. */
  busyLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Botão com texto. primary = ação principal (roxo, uma por tela/folha);
 * secondary = alternativa; ghost = discreto (Cancelar, Voltar); danger = apagar.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  busy = false,
  busyLabel,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const sizeCls =
    size === "sm"
      ? "h-10 min-h-10 pointer-coarse:h-11 pointer-coarse:min-h-11 gap-1.5 rounded-[11px] px-3.5 text-[13.5px]"
      : "h-11 gap-2 rounded-xl px-4 text-[14.5px]";
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap ${sizeCls} ${VARIANT[variant]} ${FOCUS} ${MOTION} ${stateClasses(disabled, busy)} ${className}`}
      {...rest}
    >
      {busy ? <SpinnerIcon size={size === "sm" ? 16 : 18} className="animate-spin motion-reduce:animate-none" /> : icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

const ICON_SIZE = { sm: "size-8 rounded-[10px]", md: "size-9 rounded-[11px]", lg: "size-10 rounded-xl" } as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  /** Obrigatório: vira aria-label (e title). Ex.: "Gravar áudio", "Fixar no topo". */
  label: string;
  /** O ícone, ex.: <MicIcon />. */
  icon: ReactNode;
  variant?: ButtonVariant;
  /** Tamanho visual: sm 32, md 36, lg 40 px. A área de toque é sempre >= 44×44. */
  size?: keyof typeof ICON_SIZE;
  busy?: boolean;
  /** Mostra o nome como dica ao passar o mouse (padrão: sim). */
  tooltip?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Botão só de ícone. Visual de 32–40 px, alvo invisível de 44 px centrado. */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "lg",
  busy = false,
  tooltip = true,
  disabled = false,
  type = "button",
  className = "",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={tooltip ? label : undefined}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`no-select relative inline-grid min-h-0 min-w-0 shrink-0 place-items-center ${ICON_SIZE[size]} before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-[''] ${VARIANT[variant]} ${FOCUS} ${MOTION} ${stateClasses(disabled, busy)} ${className}`}
      {...rest}
    >
      {busy ? <SpinnerIcon size={18} className="animate-spin motion-reduce:animate-none" /> : icon}
    </button>
  );
}
