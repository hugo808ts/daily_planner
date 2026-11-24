interface Props {
  /** true = "Dia certo" (compromisso); false = "Sem data" (fica na lista até ser feita). */
  dated: boolean;
  onChange: (dated: boolean) => void;
}

const OPTIONS = [
  { dated: false, label: "Sem data" },
  { dated: true, label: "Dia certo" },
] as const;

/** "Quando?": Sem data (padrão) ou Dia certo. */
export function WhenToggle({ dated, onChange }: Props) {
  const onKey = (e: React.KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      onChange(!dated);
      const next = (e.currentTarget.parentElement?.querySelector(`[data-dated="${!dated}"]`) as HTMLElement | null);
      next?.focus();
    }
  };
  return (
    <div className="mb-4">
      <span id="when-label" className="eyebrow mb-1.5 block">
        Quando?
      </span>
      <div role="radiogroup" aria-labelledby="when-label" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white/[0.035] p-1">
        {OPTIONS.map((o) => {
          const on = o.dated === dated;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={on}
              data-dated={o.dated}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.dated)}
              onKeyDown={onKey}
              className={`min-h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                on ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {!dated && <p className="mt-1.5 text-[13px] text-muted">Fica na lista até você marcar. O XP conta no dia em que fizer.</p>}
    </div>
  );
}
