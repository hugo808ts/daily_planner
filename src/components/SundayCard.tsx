/** Cartão de domingo no topo da tela Hoje: leva ao resumo da semana que fechou. */
export function SundayCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-3 flex w-full items-center justify-between gap-3 rounded-[20px] bg-accent/10 px-4 py-3 text-left active:bg-accent/20"
    >
      <span className="font-semibold">📊 Sua semana fechou</span>
      <span className="text-sm font-semibold text-accent">Ver resumo ›</span>
    </button>
  );
}
