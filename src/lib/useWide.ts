import { useSyncExternalStore } from "react";

/** A partir daqui o app vira o layout de computador (Hoje à esquerda, Ideias em três colunas). */
export const WIDE_QUERY = "(min-width: 1024px)";

const media = () => window.matchMedia(WIDE_QUERY);

function subscribe(onChange: () => void) {
  const m = media();
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/** true na tela de computador; acompanha o redimensionamento da janela. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media().matches,
    () => false,
  );
}
