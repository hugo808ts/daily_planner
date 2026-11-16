import { useEffect, useState, type ReactNode } from "react";
import type { FinanceView } from "../../shared/finance";
import {
  CartoesSection,
  CategoriasCard,
  ContasFixasCard,
  InvestimentosCard,
  MesCard,
  MovimentacoesCard,
  PatrimonioCard,
} from "../components/finance/FinanceSections";
import { Button, IconButton } from "../components/ui/Button";
import { EyeIcon, EyeOffIcon, WalletIcon } from "../components/ui/Icon";
import { drawerSyncLabel, monthShort, whenSynced } from "../lib/financeFormat";
import { useFinance } from "../lib/useFinance";
import "./finance.css";

interface Props {
  /** Botão ☰ (celular). */
  menu?: ReactNode;
  wide?: boolean;
  /** Linha do menu lateral ("Atualizado pelo agente às 08:30"); null enquanto não há retrato. */
  onSyncLabel?: (label: string | null) => void;
}

/** Olho fechado/aberto: conveniência deste aparelho. */
const HIDDEN_KEY = "agenda:finance-hidden";
const readHidden = () => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
};
const saveHidden = (on: boolean) => {
  try {
    localStorage.setItem(HIDDEN_KEY, on ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
};

const MOBILE_PAD = {
  paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--tabbar-h) + 2rem)",
};

function MonthChips({ v, onPick }: { v: FinanceView; onPick: (m: string) => void }) {
  const year = v.today.slice(0, 4);
  // Do mais antigo (esquerda) ao mais novo (direita), como no rascunho.
  const meses = [...v.meses].reverse();
  return (
    <div className="fin-months" role="group" aria-label="Mês">
      {meses.map((m) => {
        const on = m === v.month;
        const label = on || m.slice(0, 4) !== year ? `${monthShort(m)} ${m.slice(0, 4)}` : monthShort(m);
        return (
          <button key={m} type="button" aria-pressed={on} onClick={() => onPick(m)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando o financeiro">
      <div className="fin-skel mt-3.5 h-9 w-48 rounded-full" />
      <div className="fin-skel mt-3 h-[150px]" />
      <div className="fin-skel mt-3 h-[260px]" />
      <div className="fin-skel mt-3 h-[170px]" />
    </div>
  );
}

/** Painel financeiro (só leitura): o retrato vem do Agente Finanças no PC. */
export function Finance({ menu, wide = false, onSyncLabel }: Props) {
  const [month, setMonth] = useState<string | null>(null);
  const { data, error, reload } = useFinance(month);
  const [hidden, setHidden] = useState(readHidden);

  const view = data && !data.empty ? data : null;

  useEffect(() => {
    if (!onSyncLabel || !data) return;
    onSyncLabel(data.empty ? null : drawerSyncLabel(data.generatedAt, data.today));
  }, [data, onSyncLabel]);

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    saveHidden(next);
  };

  let body: ReactNode;
  if (error && !data) {
    body = (
      <div role="alert" className="glass-quiet fin-card text-center">
        <p className="text-[15px] font-semibold">{error}</p>
        <Button className="mt-3" onClick={() => void reload()}>
          Tentar de novo
        </Button>
      </div>
    );
  } else if (!data) {
    body = <Skeleton />;
  } else if (data.empty) {
    body = (
      <div className="glass fin-card text-center" data-testid="finance-empty">
        <span aria-hidden className="fin-ic mx-auto mt-2 size-12 rounded-2xl">
          <WalletIcon size={22} />
        </span>
        <h2 className="mt-3 text-[17px] font-bold">Nada sincronizado ainda</h2>
        <p className="meta mx-auto mt-1 max-w-[34ch]">
          Peça ao Agente Finanças para sincronizar. O painel aparece aqui logo depois.
        </p>
      </div>
    );
  } else {
    const v = data;
    const parts = (
      <>
        <div>
          <PatrimonioCard v={v} hidden={hidden} />
          <MesCard v={v} hidden={hidden} />
          <CategoriasCard v={v} hidden={hidden} />
        </div>
        <div>
          <CartoesSection v={v} hidden={hidden} />
          <ContasFixasCard v={v} hidden={hidden} />
        </div>
        <div>
          <InvestimentosCard v={v} hidden={hidden} />
          <MovimentacoesCard v={v} hidden={hidden} />
        </div>
      </>
    );
    body = (
      <>
        <MonthChips v={v} onPick={setMonth} />
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger-ink">
            {error}
          </p>
        )}
        {wide ? <div className="fin-grid">{parts}</div> : parts}
        <p className="fin-sync">
          <i aria-hidden />
          Sincronizado pelo Agente Finanças {whenSynced(v.generatedAt, v.today)}
        </p>
      </>
    );
  }

  return (
    <div className={wide ? "pane h-full px-8 pt-[22px] pb-8" : "mx-auto w-full max-w-md px-4"} style={wide ? undefined : MOBILE_PAD}>
      <div className="flex min-h-11 items-center gap-2.5">
        {menu}
        <h1 className="eyebrow m-0 flex-1">Financeiro</h1>
        {view && (
          <IconButton
            label={hidden ? "Mostrar valores" : "Esconder valores"}
            aria-pressed={hidden}
            variant="secondary"
            icon={hidden ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            onClick={toggleHidden}
          />
        )}
      </div>
      {body}
    </div>
  );
}
