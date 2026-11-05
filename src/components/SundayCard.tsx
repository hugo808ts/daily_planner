import { useEffect, useState } from "react";
import { todayISO, weekStart } from "../../shared/dates";
import type { MedalTier } from "../../shared/xp";
import { api } from "../lib/api";
import { WEEK_TITLE } from "../screens/MedalReveal";
import { Medal, MedalPlaceholder } from "./game/Medal";
import { ChevronRightIcon } from "./ui/Icon";

/** Cartão de domingo no topo da tela Hoje: mostra a medalha da semana que fechou e abre a revelação. */
export function SundayCard({ onOpen }: { onOpen: () => void }) {
  const [week, setWeek] = useState<{
    xp: number;
    medal: MedalTier | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .progress(weekStart(todayISO()))
      .then((p) => {
        if (alive) setWeek({ xp: p.weekXp, medal: p.medal });
      })
      .catch(() => {
        if (alive) setWeek(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const subtitle = !week ? null : week.medal ? `${WEEK_TITLE[week.medal]} · ${week.xp} XP` : "Semana sem medalha";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-3 flex w-full items-center justify-between gap-3 rounded-[20px] bg-accent-soft px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-accent-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center">
          {week?.medal ? (
            <Medal tier={week.medal} size={week.medal === "supremo" ? 32 : 42} />
          ) : (
            <MedalPlaceholder size={38} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Sua semana fechou</span>
          {subtitle && <span className="block truncate text-meta text-muted">{subtitle}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-accent-ink">
        Ver medalha
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}
