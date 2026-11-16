import type { CSSProperties } from "react";
import type { CartaoView, CategoriaMes, FinanceView, MovView } from "../../../shared/finance";
import { prevMonth, SEM_CATEGORIA } from "../../../shared/finance";
import { money, moneyParts } from "../../lib/format";
import {
  CLASSE_LABEL,
  CLASSE_SIGLA,
  ddmm,
  FORMA_LABEL,
  monthLong,
  monthShort,
  pctSigned,
  pctText,
  relDay,
} from "../../lib/financeFormat";
import {
  AdjustIcon,
  BusIcon,
  CartIcon,
  CreditCardIcon,
  EducationIcon,
  HealthIcon,
  HouseIcon,
  IncomeIcon,
  InvestIcon,
  LeisureIcon,
  MoneyIcon,
  PiggyBankIcon,
  ReceiptIcon,
  RefundIcon,
  ShoppingBagIcon,
  SubscriptionIcon,
  TransferIcon,
  UtensilsIcon,
  type IconComponent,
} from "../ui/Icon";

/** Valor grande com centavos menores ("R$ 12.480" + ",90"). */
function Big({ cents, hidden }: { cents: number; hidden: boolean }) {
  const p = moneyParts(cents, hidden);
  return (
    <>
      {p.main}
      {p.cents && <small>{p.cents}</small>}
    </>
  );
}

// ===================== Patrimônio =====================

export function PatrimonioCard({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  return (
    <section className="glass fin-card" aria-labelledby="fin-patrimonio">
      <h2 id="fin-patrimonio" className="eyebrow">
        Patrimônio
      </h2>
      <p className="fin-hero" data-testid="patrimonio">
        <Big cents={v.patrimonio.total} hidden={hidden} />
      </p>
      <div className="fin-split">
        <div className="fin-mini">
          <span className="eyebrow">Em contas</span>
          <b>{money(v.patrimonio.contas, { hidden, whole: true })}</b>
        </div>
        <div className="fin-mini">
          <span className="eyebrow">Investido</span>
          <b>{money(v.patrimonio.investido, { hidden, whole: true })}</b>
        </div>
      </div>
    </section>
  );
}

// ===================== Mês (entrou, saiu, gráfico) =====================

const W = 300;
const H = 120;

function MonthChart({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  const { acumulado, projecao, diasNoMes, diaHoje } = v.mes;
  const last = acumulado.at(-1) ?? 0;
  const max = Math.max(projecao ?? 0, last, 1) * 1.08;
  const x = (i: number) => (diasNoMes > 1 ? (i / (diasNoMes - 1)) * W : 0);
  const y = (val: number) => H - 4 - (val / max) * (H - 12);
  const pts = acumulado.map((val, i) => `${x(i).toFixed(1)} ${y(val).toFixed(1)}`);
  const lastX = x(acumulado.length - 1);
  const lastY = y(last);
  const line = pts.length ? `M${pts.join(" L")}` : "";
  const area = pts.length ? `${line} L${lastX.toFixed(1)} ${H} L0 ${H}Z` : "";
  const showProj = projecao !== null && acumulado.length > 0 && acumulado.length < diasNoMes;
  const label = `Gasto acumulado em ${monthLong(v.month)}${
    showProj && !hidden ? `, com projeção de ${money(projecao!)} no fim do mês` : ""
  }`;
  const mes = monthShort(v.month);
  return (
    <>
      <div className="fin-chart" role="img" aria-label={label}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="fin-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#88ef1b" stopOpacity=".35" />
              <stop offset="1" stopColor="#00b000" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M0 30H${W}M0 60H${W}M0 90H${W}`} stroke="rgb(255 255 255 / .06)" vectorEffect="non-scaling-stroke" />
          {area && <path d={area} fill="url(#fin-area)" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="#88ef1b"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: "drop-shadow(0 0 3px rgb(136 239 27 / .7))" }}
            />
          )}
          {showProj && (
            <path
              data-testid="projecao"
              d={`M${lastX.toFixed(1)} ${lastY.toFixed(1)} L${W} ${y(projecao!).toFixed(1)}`}
              fill="none"
              stroke="#88ef1b"
              strokeOpacity=".4"
              strokeWidth="2"
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {diaHoje !== null && acumulado.length > 0 && (
          <span aria-hidden className="fin-dot" style={{ left: `${(lastX / W) * 100}%`, top: `${(lastY / H) * 100}%` }} />
        )}
      </div>
      <div className="fin-axis" aria-hidden>
        <span>1 {mes}</span>
        {diaHoje !== null && <span>hoje · {diaHoje}</span>}
        <span>
          {diasNoMes} {mes}
        </span>
      </div>
    </>
  );
}

export function MesCard({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  const { entrou, saiu, sobra } = v.mes;
  return (
    <section className="glass-quiet fin-card" aria-labelledby="fin-mes">
      <div className="fin-head">
        <h2 id="fin-mes">Mês de {monthLong(v.month)}</h2>
        <span className={`fin-delta ${sobra >= 0 ? "fin-up" : "fin-down"}`}>
          {sobra >= 0 ? "sobra " : "faltou "}
          {money(Math.abs(sobra), { hidden, whole: true })}
        </span>
      </div>
      <div className="fin-split" style={{ marginTop: 10 }}>
        <div>
          <span className="eyebrow">Entrou</span>
          <div className="fin-big fin-up">{money(entrou, { hidden, whole: true })}</div>
        </div>
        <div>
          <span className="eyebrow">Saiu</span>
          <div className="fin-big">{money(saiu, { hidden, whole: true })}</div>
        </div>
      </div>
      <MonthChart v={v} hidden={hidden} />
    </section>
  );
}

// ===================== Gastos por categoria =====================

/** Paleta em ordem fixa; da 7ª categoria em diante tudo vira "Outros". */
const CAT_COLORS = ["#88ef1b", "#00b000", "#bfebbf", "#f0f0f0", "#2f7a2f", "#a8a8a8"];
const OUTROS_COLOR = "#5a5a5a";
const MAX_CATS = 6;

type Slice = { nome: string; total: number; pct: number; variacao: number | null; color: string };

function slices(cats: CategoriaMes[]): Slice[] {
  const top = cats.slice(0, MAX_CATS).map((c, i) => ({
    nome: c.categoria,
    total: c.total,
    pct: c.pct,
    variacao: c.variacao,
    color: CAT_COLORS[i],
  }));
  const rest = cats.slice(MAX_CATS);
  if (!rest.length) return top;
  const total = rest.reduce((a, c) => a + c.total, 0);
  const pct = Math.round(rest.reduce((a, c) => a + c.pct, 0) * 10) / 10;
  return [...top, { nome: "Outros", total, pct, variacao: null, color: OUTROS_COLOR }];
}

export function CategoriasCard({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  const s = slices(v.categorias);
  const total = s.reduce((a, c) => a + c.total, 0);
  let acc = 0;
  const stops = s.map((c) => {
    const from = (acc / total) * 100;
    acc += c.total;
    return `${c.color} ${from.toFixed(2)}% ${((acc / total) * 100).toFixed(2)}%`;
  });
  const prev = monthShort(prevMonth(v.month));
  const temVariacao = s.some((c) => c.variacao !== null);
  return (
    <section className="glass-quiet fin-card" aria-labelledby="fin-cats">
      <div className="fin-head">
        <h2 id="fin-cats">Gastos por categoria</h2>
        {temVariacao && <span className="eyebrow">vs {prev}</span>}
      </div>
      {s.length === 0 ? (
        <p className="meta mt-3">Nenhum gasto neste mês.</p>
      ) : (
        <div className="fin-donut-row">
          <div className="fin-donut" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
            <div>
              <span className="eyebrow" style={{ fontSize: 9 }}>
                Total
              </span>
              <strong>{money(total, { hidden, whole: true })}</strong>
            </div>
          </div>
          <ul className="fin-cats">
            {s.map((c) => (
              <li key={c.nome} className="fin-cat" data-testid="categoria">
                <i style={{ background: c.color, color: c.color }} />
                <span>{c.nome}</span>
                <span>
                  {pctText(c.pct)}
                  {c.variacao !== null && (
                    <small className={c.variacao > 0 ? "fin-down" : c.variacao < 0 ? "fin-up" : ""}>
                      {pctSigned(c.variacao)}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ===================== Cartões =====================

function CartaoCard({ k, alt, hidden }: { k: CartaoView; alt: boolean; hidden: boolean }) {
  const fatura = k.faturaMes ? `Fatura de ${monthLong(k.faturaMes)}` : "Fatura atual";
  const soon = k.diasVencimento <= 1;
  let bar;
  if (k.meta !== null && k.meta > 0) {
    // A meta fica a 80% da barra (ou antes, se a fatura já passou dela).
    const scale = Math.max(k.meta / 0.8, k.faturaAtual);
    const over = k.faturaAtual > k.meta;
    const resta = k.meta - k.faturaAtual;
    bar = (
      <>
        <div className="fin-bar" aria-hidden>
          <i className={over ? "over" : ""} style={{ width: `${(k.faturaAtual / scale) * 100}%` }} />
          <em style={{ left: `${(k.meta / scale) * 100}%` }} />
        </div>
        <div className="fin-lbl">
          <span>meta {money(k.meta, { hidden, whole: true })}</span>
          <span>
            {over ? "passou " : "restam "}
            <b className={over ? "fin-down" : "fin-up"}>{money(Math.abs(resta), { hidden, whole: true })}</b>
          </span>
        </div>
      </>
    );
  } else {
    bar = (
      <>
        <div className="fin-bar" aria-hidden>
          <i style={{ width: `${Math.min(k.usoPct, 100)}%` }} />
        </div>
        <div className="fin-lbl">
          <span>limite usado {pctText(Math.round(k.usoPct))}</span>
          <span>disp. {money(k.disponivel, { hidden, whole: true })}</span>
        </div>
      </>
    );
  }
  return (
    <li className={`fin-ccard${alt ? " alt" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <b className="truncate text-[15px]">{k.nome}</b>
        <span aria-hidden className="chip-c" />
      </div>
      <div className="mt-[18px]">
        <span className="eyebrow">{fatura}</span>
        <br />
        <strong>
          <Big cents={k.faturaAtual} hidden={hidden} />
        </strong>
      </div>
      <div className="fin-due">
        FECHA {ddmm(k.proximoFechamento)} · VENCE {ddmm(k.proximoVencimento)} ·{" "}
        <span className={soon ? "text-danger-ink" : ""}>{k.rotuloVencimento}</span>
      </div>
      {bar}
    </li>
  );
}

export function CartoesSection({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  if (!v.cartoes.length) return null;
  return (
    <section className="mt-5" aria-labelledby="fin-cartoes">
      <div className="fin-head px-1">
        <h2 id="fin-cartoes" style={{ fontSize: 18 }}>
          Cartões
        </h2>
        <span className="eyebrow">
          {v.cartoes.length} {v.cartoes.length === 1 ? "ativo" : "ativos"}
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {v.cartoes.map((k, i) => (
          <CartaoCard key={k.nome} k={k} alt={i % 2 === 1} hidden={hidden} />
        ))}
      </ul>
    </section>
  );
}

// ===================== Contas fixas =====================

export function ContasFixasCard({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  if (!v.contasFixas.length) return null;
  const total = v.contasFixas.reduce((a, f) => a + f.valor, 0);
  return (
    <section className="glass-quiet fin-card" aria-labelledby="fin-fixas">
      <div className="fin-head mb-1.5">
        <h2 id="fin-fixas">Contas fixas do mês</h2>
        <span className="eyebrow">{money(total, { hidden, whole: true })}</span>
      </div>
      <ul className="fin-list">
        {v.contasFixas.map((f) => {
          const passou = f.status === "passou";
          const tag = passou ? "past" : f.status === "futuro" ? "ok" : "soon";
          return (
            <li key={`${f.descricao}-${f.dia}`} className="fin-it" data-testid="conta-fixa">
              <span aria-hidden className={`fin-ic${passou ? " gray" : ""}`}>
                {String(f.dia).padStart(2, "0")}
              </span>
              <div className="fin-tx">
                <b>{f.descricao}</b>
                <small>
                  {FORMA_LABEL[f.forma]} · dia {f.dia}
                </small>
              </div>
              <span className={`fin-tag ${tag}`}>{f.rotulo}</span>
              <div className="fin-val">{money(f.valor, { hidden, whole: true })}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ===================== Investimentos =====================

const CLASSE_COLORS = ["#88ef1b", "#00b000", "#bfebbf", "#f0f0f0", "#2f7a2f", "#a8a8a8", "#5a5a5a"];

export function InvestimentosCard({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  const inv = v.investimentos;
  if (!inv.itens.length) return null;
  return (
    <section className="glass fin-card" aria-labelledby="fin-inv">
      <div className="fin-head">
        <h2 id="fin-inv" style={{ fontSize: 18 }}>
          Investimentos
        </h2>
        {inv.rendimentos > 0 && (
          <span className="fin-delta fin-up">{money(inv.rendimentos, { hidden, whole: true, sign: 1 })} rend.</span>
        )}
      </div>
      <p className="fin-hero" style={{ fontSize: 34 }}>
        <Big cents={inv.total} hidden={hidden} />
      </p>
      <div className="fin-alloc" aria-hidden>
        {inv.alocacao.map((a, i) => (
          <i
            key={a.classe}
            style={{
              width: `${a.pct}%`,
              background: CLASSE_COLORS[i % CLASSE_COLORS.length],
              boxShadow: i === 0 ? "0 0 10px #88ef1b" : undefined,
            }}
          />
        ))}
      </div>
      <ul className="fin-legend">
        {inv.alocacao.map((a, i) => (
          <li key={a.classe} style={{ "--c": CLASSE_COLORS[i % CLASSE_COLORS.length] } as CSSProperties}>
            {CLASSE_LABEL[a.classe]} {pctText(Math.round(a.pct))}
          </li>
        ))}
      </ul>
      <ul className="fin-list mt-2.5">
        {inv.itens.map((i) => (
          <li key={i.codigo} className="fin-it">
            <span aria-hidden className={`fin-ic${i.temCotacao ? "" : " gray"}`}>
              {CLASSE_SIGLA[i.classe]}
            </span>
            <div className="fin-tx">
              <b>{i.codigo}</b>
              <small>
                {i.temCotacao && i.cotacao !== null
                  ? `${i.quantidade.toLocaleString("pt-BR")} cotas · ${money(i.cotacao, { hidden })}${
                      i.dataCotacao ? ` em ${ddmm(i.dataCotacao)}` : ""
                    }`
                  : `${i.onde} · custo`}
              </small>
            </div>
            <div className="fin-val">{money(i.valor, { hidden, whole: true })}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ===================== Movimentações =====================

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Ícone por categoria (palavras-chave), com o tipo da movimentação como reserva. */
const CAT_ICONS: [RegExp, IconComponent][] = [
  [/mercado|supermerc/, CartIcon],
  [/aliment|restaur|comida|delivery|lanche/, UtensilsIcon],
  [/morad|aluguel|casa|condom/, HouseIcon],
  [/transp|uber|onibus|combust|gasolina/, BusIcon],
  [/saude|farmac|medic/, HealthIcon],
  [/lazer|cinema|viag/, LeisureIcon],
  [/compra|roupa/, ShoppingBagIcon],
  [/assinat|stream/, SubscriptionIcon],
  [/educa|curso|faculd|livro/, EducationIcon],
  [/conta|boleto|imposto|taxa/, ReceiptIcon],
  [/salario|receb|renda|pix/, IncomeIcon],
];

const TIPO_ICONS: Partial<Record<MovView["tipo"], IconComponent>> = {
  receita: IncomeIcon,
  transferencia: TransferIcon,
  aporte: PiggyBankIcon,
  resgate: InvestIcon,
  pagamento_fatura: CreditCardIcon,
  estorno: RefundIcon,
  ajuste: AdjustIcon,
};

const TIPO_LABEL: Partial<Record<MovView["tipo"], string>> = {
  receita: "Receita",
  transferencia: "Transferência",
  aporte: "Aporte",
  resgate: "Resgate",
  pagamento_fatura: "Fatura",
  estorno: "Estorno",
  ajuste: "Ajuste",
};

function movIcon(m: MovView): IconComponent {
  if (m.tipo !== "gasto" && TIPO_ICONS[m.tipo]) return TIPO_ICONS[m.tipo]!;
  const k = norm(m.categoria);
  return CAT_ICONS.find(([re]) => re.test(k))?.[1] ?? MoneyIcon;
}

export function MovimentacoesCard({ v, hidden }: { v: FinanceView; hidden: boolean }) {
  if (!v.movimentacoes.length) return null;
  return (
    <section className="glass-quiet fin-card" aria-labelledby="fin-movs">
      <div className="fin-head mb-1.5">
        <h2 id="fin-movs">Últimas movimentações</h2>
      </div>
      <ul className="fin-list">
        {v.movimentacoes.map((m) => {
          const Icon = movIcon(m);
          const meta = [relDay(m.data, v.today), m.parcelaNum && m.parcelaTotal ? `${m.parcelaNum}/${m.parcelaTotal}` : null, m.onde]
            .filter(Boolean)
            .join(" · ");
          const cat = m.categoria === SEM_CATEGORIA ? (TIPO_LABEL[m.tipo] ?? m.categoria) : m.categoria;
          return (
            <li key={m.id} className="fin-it" data-testid="movimentacao">
              <span aria-hidden className={`fin-ic${m.sinal === 1 ? "" : " gray"}`}>
                <Icon size={17} />
              </span>
              <div className="fin-tx">
                <b>{m.descricao}</b>
                <small>{meta}</small>
              </div>
              <div className={`fin-val${m.sinal === 1 ? " fin-up" : ""}`}>
                {money(m.valor, { hidden, sign: m.sinal })}
                <small>{cat}</small>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
