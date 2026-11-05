export interface LevelBarProps {
  level: number;
  /** XP acumulado dentro do nível atual. */
  into: number;
  /** XP necessário para completar o nível atual. */
  needed: number;
  compact?: boolean;
}

/** Selo do nível + barra de progresso animada (transição CSS). */
export function LevelBar({ level, into, needed, compact = false }: LevelBarProps) {
  const pct = needed > 0 ? Math.min(100, Math.max(0, (into / needed) * 100)) : 0;
  const size = compact ? "size-8 text-[14px] rounded-[10px]" : "size-[38px] text-[16px] rounded-xl";
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border border-line bg-surface ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
    >
      <span
        aria-hidden
        className={`level-badge no-select grid shrink-0 place-items-center font-display font-extrabold ${size}`}
      >
        {level}
      </span>
      <div
        role="progressbar"
        aria-label={`Nível ${level}`}
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={Math.min(into, needed)}
        aria-valuetext={`Nível ${level}, ${into} de ${needed} XP`}
        className="min-w-0 flex-1"
      >
        <div className="flex justify-between gap-2 text-meta text-muted">
          <b className="font-semibold text-ink">Nível {level}</b>
          <span>
            {into} / {needed} XP
          </span>
        </div>
        <div className="level-track mt-1.5 h-2 overflow-hidden rounded-full">
          <i className="level-fill block h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
