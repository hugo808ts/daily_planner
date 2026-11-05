import { ChevronRightIcon, ReportIcon } from "./ui/Icon";

/** Cartão de domingo no topo da tela Hoje: leva ao resumo da semana que fechou. */
export function SundayCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-3 flex w-full items-center justify-between gap-3 rounded-[20px] bg-accent-soft px-4 py-3 text-left transition-colors duration-150 hover:bg-accent-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex items-center gap-2 font-semibold">
        <ReportIcon className="text-accent-ink" />
        Sua semana fechou
      </span>
      <span className="flex items-center gap-0.5 text-sm font-semibold text-accent-ink">
        Ver resumo
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}
