import type { ReactNode } from "react";
import { DumbbellIcon } from "../components/ui/Icon";

interface Props {
  /** Botão ☰ (celular). */
  menu?: ReactNode;
  wide?: boolean;
}

/** Esqueleto da Fase 3 (navegação): a Fase 4 troca pela semana de treinos de verdade. */
export function Workout({ menu, wide = false }: Props) {
  return (
    <div
      className={wide ? "pane h-full px-8 pt-[22px] pb-8" : "mx-auto w-full max-w-md px-4"}
      style={
        wide
          ? undefined
          : {
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
              // Sem captura embaixo, só a barra de baixo.
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 2rem)",
            }
      }
    >
      {menu && <div className="mb-1 flex min-h-11 items-center">{menu}</div>}
      <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Treino</h1>

      <section aria-labelledby="treino-vazio" className="glass mt-5 flex flex-col items-center rounded-[22px] px-6 py-8 text-center">
        <span aria-hidden className="grid size-12 place-items-center rounded-2xl fill-neon">
          <DumbbellIcon size={24} strokeWidth={2.2} />
        </span>
        <h2 id="treino-vazio" className="mt-4 font-display text-lg font-bold">
          Monte sua semana
        </h2>
        <p className="mt-1.5 max-w-[30ch] text-sm text-muted">
          Crie os treinos A, B e C e escolha o dia de cada um. Em breve.
        </p>
      </section>
    </div>
  );
}
