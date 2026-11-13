import type { ReactNode } from "react";

interface Props {
  /** Botão ☰ (celular). */
  menu?: ReactNode;
  wide?: boolean;
}

/** PLACEHOLDER da Fase 3 (menu lateral): a Fase 4 troca pelo painel financeiro de verdade. */
export function Finance({ menu, wide = false }: Props) {
  return (
    <div
      className={wide ? "pane h-full px-8 pt-[22px] pb-8" : "mx-auto w-full max-w-md px-4"}
      style={
        wide
          ? undefined
          : {
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
            }
      }
    >
      {menu && (
        <div className="mb-1 flex min-h-11 items-center">{menu}</div>
      )}
      <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Financeiro</h1>
      <p className="mt-2 text-sm text-muted">Em construção</p>
    </div>
  );
}
