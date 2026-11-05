import { useId, type ReactNode } from "react";
import { FOLDER_ICONS, isIconKey } from "./FolderGrid";

interface Props {
  value: string | null;
  onChange: (key: string | null) => void;
  /** Valor antigo (emoji de verdade) que continua escolhível até o usuário trocar por um ícone. */
  legacy?: string | null;
  label?: string;
  className?: string;
}

/** Seletor de ícone de pasta (o mesmo na folha de pasta das Ideias e na confirmação da captura). */
export function FolderIconPicker({ value, onChange, legacy = null, label = "Ícone", className = "mt-4" }: Props) {
  const labelId = useId();
  const old = legacy && !isIconKey(legacy) ? legacy : null;
  const options: { key: string | null; label: string; node: ReactNode }[] = [
    ...(old ? [{ key: old, label: `Emoji ${old}`, node: <span aria-hidden className="text-lg">{old}</span> }] : []),
    ...FOLDER_ICONS.map(({ key, label, Icon }) => ({ key, label, node: <Icon size={20} /> })),
  ];
  return (
    <div className={className}>
      <p id={labelId} className="mb-1.5 text-xs font-medium text-muted">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.key;
          return (
            <button
              key={o.key ?? "default"}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.key)}
              className={`no-select grid size-11 place-items-center rounded-xl border-[1.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-bg text-ink hover:border-dot"
              }`}
            >
              {o.node}
            </button>
          );
        })}
      </div>
    </div>
  );
}
