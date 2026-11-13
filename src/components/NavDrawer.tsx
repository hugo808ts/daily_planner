import { useEffect, useRef, type ReactNode } from "react";
import type { Progress } from "../lib/api";
import { Medal, MedalPlaceholder, MEDAL_LABEL } from "./game/Medal";
import { IconButton } from "./ui/Button";
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  DumbbellIcon,
  HelpIcon,
  LightbulbIcon,
  SettingsIcon,
  ShieldIcon,
  WalletIcon,
  type IconComponent,
} from "./ui/Icon";

/** Telas que o menu troca (o hash mora no App). */
export type Section = "today" | "ideas" | "workout" | "finance";

interface Props {
  current: Section;
  progress: Progress | null;
  /** "N/M" das tarefas de hoje; some enquanto não carrega. */
  todayCount?: string | null;
  /** Selo NOVO no Financeiro (até a primeira visita). */
  financeNew?: boolean;
  /** Linha de sincronização do rodapé (Fase 4: "Finanças sincronizadas há 5 min"). */
  syncLabel?: string | null;
  onNavigate: (s: Section) => void;
  /** "Quadro da semana": resumo da semana atual. */
  onOpenWeek: () => void;
  onClose: () => void;
}

function Item({
  icon: Icon,
  label,
  current = false,
  disabled = false,
  onClick,
  children,
}: {
  icon: IconComponent;
  label: string;
  current?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        className="drawer-item focus-visible:-outline-offset-2"
        aria-current={current ? "page" : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon size={20} />
        {label}
        {children}
      </button>
    </li>
  );
}

const NewBadge = () => (
  <span className="ml-auto rounded-md bg-lime px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.1em] text-on-accent shadow-[0_0_10px_rgb(136_239_27/0.5)]">
    NOVO
  </span>
);

/**
 * Menu lateral (celular e computador): <dialog> modal que entra pela esquerda.
 * Esc e toque fora fecham; quem abre cuida de devolver o foco ao botão ☰.
 */
export function NavDrawer({ current, progress, todayCount, financeNew, syncLabel, onNavigate, onOpenWeek, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const go = (s: Section) => {
    onClose();
    onNavigate(s);
  };

  const pct = progress && progress.needed > 0 ? Math.min(100, Math.max(0, (progress.into / progress.needed) * 100)) : 0;

  return (
    <dialog
      ref={dialog}
      aria-label="Menu"
      className="drawer-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Toque no fundo escurecido: o alvo é o próprio <dialog> (o conteúdo cobre o resto).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex min-h-full flex-col px-3.5"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
        }}
      >
        <div className="flex items-center gap-2.5 px-1.5">
          <span aria-hidden className="grid size-[34px] place-items-center rounded-[11px] fill-neon">
            <CheckIcon size={18} strokeWidth={3} />
          </span>
          <span translate="no" className="font-display text-lg font-extrabold tracking-[-0.02em]">
            Agenda
          </span>
          <IconButton label="Fechar menu" icon={<CloseIcon size={20} />} className="ml-auto text-muted" onClick={onClose} />
        </div>

        <div className="glass mt-[18px] mb-2 flex items-center gap-3 rounded-[18px] p-3">
          {progress?.medal ? (
            <Medal tier={progress.medal} size={47} ribbon={false} />
          ) : (
            <MedalPlaceholder size={47} />
          )}
          <div className="min-w-0 flex-1">
            <span className="eyebrow">
              {progress
                ? `Nível ${progress.level}${progress.medal ? ` · ${MEDAL_LABEL[progress.medal]}` : ""}`
                : "Nível"}
            </span>
            <strong className="block text-[15px] tabular-nums">{progress ? `${progress.weekXp} XP na semana` : "—"}</strong>
            <div aria-hidden className="level-track mt-[7px] h-1.5 overflow-hidden rounded">
              <i className="level-fill block h-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <nav aria-label="Navegação" className="flex flex-1 flex-col">
          <p id="nav-rotina" className="eyebrow mx-1.5 mt-4 mb-1.5">
            Rotina
          </p>
          <ul aria-labelledby="nav-rotina">
            <Item icon={CalendarIcon} label="Tarefas do dia" current={current === "today"} onClick={() => go("today")}>
              {todayCount && <small>{todayCount}</small>}
            </Item>
            <Item
              icon={ShieldIcon}
              label="Quadro da semana"
              onClick={() => {
                onClose();
                onOpenWeek();
              }}
            >
              {progress?.medal && <small>{MEDAL_LABEL[progress.medal]}</small>}
            </Item>
            <Item icon={LightbulbIcon} label="Ideias" current={current === "ideas"} onClick={() => go("ideas")} />
            <Item icon={DumbbellIcon} label="Treino" current={current === "workout"} onClick={() => go("workout")} />
          </ul>

          <p id="nav-paineis" className="eyebrow mx-1.5 mt-4 mb-1.5">
            Painéis
          </p>
          <ul aria-labelledby="nav-paineis">
            <Item icon={WalletIcon} label="Financeiro" current={current === "finance"} onClick={() => go("finance")}>
              {financeNew && <NewBadge />}
            </Item>
          </ul>

          <div className="mt-auto border-t border-line pt-2.5">
            <ul>
              <Item icon={SettingsIcon} label="Configurações" disabled>
                <small>em breve</small>
              </Item>
              <Item icon={HelpIcon} label="Ajuda" disabled>
                <small>em breve</small>
              </Item>
            </ul>
            {syncLabel && (
              <p className="flex items-center gap-2 px-3 pt-2.5 font-mono text-[11px] font-medium text-muted">
                <i aria-hidden className="size-[7px] rounded-full bg-lime shadow-[0_0_8px_var(--lime)]" />
                {syncLabel}
              </p>
            )}
          </div>
        </nav>
      </div>
    </dialog>
  );
}
