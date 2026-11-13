import { z } from "zod";
import { isRealDate } from "./dates";

/*
 * Painel Financeiro: o retrato (FinanceSnapshot) vem do Agente Finanças no PC;
 * o Worker calcula a visão (FinanceView) que a tela mostra.
 * Todos os valores em dinheiro são CENTAVOS inteiros. Datas em AAAA-MM-DD; meses em AAAA-MM.
 */

// ---------------------------------------------------------------------------
// Schema do retrato
// ---------------------------------------------------------------------------

const TEXT_MAX = 200;
const LIST_MAX = 500;
const MOV_MAX = 20_000;

const text = z.string({ error: "Texto inválido." }).max(TEXT_MAX, `Texto com mais de ${TEXT_MAX} caracteres.`);
const cents = z.number({ error: "Valor inválido (use centavos)." }).int("Use centavos inteiros.");
const day = z
  .number({ error: "Dia inválido." })
  .int("Dia inválido.")
  .min(1, "Dia inválido (1 a 31).")
  .max(31, "Dia inválido (1 a 31).");
const isoDate = z.string({ error: "Data inválida." }).refine(isRealDate, "Data inválida (use AAAA-MM-DD).");
const monthStr = z.string({ error: "Mês inválido." }).refine((s) => isMonth(s), "Mês inválido (use AAAA-MM).");
const posInt = z.number({ error: "Número inválido." }).int("Número inválido.").min(1, "Número inválido.");
const list = <T extends z.ZodType>(item: T, max = LIST_MAX) =>
  z.array(item, { error: "Lista inválida." }).max(max, `No máximo ${max} itens.`);

export const CONTA_TIPOS = ["corrente", "poupanca", "reserva", "corretora", "carteira", "beneficio"] as const;
export const FORMAS = ["cartao", "pix", "debito", "boleto"] as const;
export const CLASSES = ["fii", "acao", "etf", "renda_fixa", "tesouro", "cripto", "outro"] as const;
export const MOV_TIPOS = [
  "gasto",
  "receita",
  "transferencia",
  "aporte",
  "resgate",
  "pagamento_fatura",
  "estorno",
  "ajuste",
] as const;

export const FinanceSnapshot = z.object({
  /** Quando o agente montou o retrato (ISO com fuso, ex.: 2026-11-09T08:30-03:00). */
  generatedAt: z
    .string({ error: "Data de geração inválida." })
    .max(40, "Data de geração inválida.")
    .refine((s) => /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s)), "Data de geração inválida (use ISO 8601)."),
  contas: list(
    z.object({
      nome: text,
      instituicao: text,
      tipo: z.enum(CONTA_TIPOS, { error: "Tipo de conta inválido." }),
      saldo: cents,
    }),
  ),
  cartoes: list(
    z.object({
      nome: text,
      limite: cents,
      usado: cents,
      disponivel: cents,
      meta: cents.nullable(),
      faturaAtual: cents,
      faturaMes: monthStr.nullable(),
      fechamento: day,
      vencimento: day,
    }),
  ),
  contasFixas: list(
    z.object({
      descricao: text,
      valor: cents,
      dia: day,
      forma: z.enum(FORMAS, { error: "Forma de pagamento inválida." }),
      ativa: z.boolean({ error: "Valor inválido (use true ou false)." }),
    }),
  ),
  investimentos: list(
    z.object({
      codigo: text,
      classe: z.enum(CLASSES, { error: "Classe de investimento inválida." }),
      onde: text,
      quantidade: z.number({ error: "Quantidade inválida." }),
      custo: cents,
      rendimentos: cents,
      /** Preço de uma cota, em centavos. */
      cotacao: cents.nullable(),
      dataCotacao: isoDate.nullable(),
    }),
  ),
  /** Só os últimos 13 meses. */
  movimentacoes: list(
    z.object({
      id: z.number({ error: "Id inválido." }).int("Id inválido."),
      data: isoDate,
      descricao: text,
      valor: cents,
      tipo: z.enum(MOV_TIPOS, { error: "Tipo de movimentação inválido." }),
      categoria: text.nullable(),
      onde: text.nullable(),
      parcelaNum: posInt.nullable(),
      parcelaTotal: posInt.nullable(),
    }),
    MOV_MAX,
  ),
});

export type FinanceSnapshot = z.infer<typeof FinanceSnapshot>;
export type Conta = FinanceSnapshot["contas"][number];
export type Cartao = FinanceSnapshot["cartoes"][number];
export type ContaFixa = FinanceSnapshot["contasFixas"][number];
export type Investimento = FinanceSnapshot["investimentos"][number];
export type Movimentacao = FinanceSnapshot["movimentacoes"][number];

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/** AAAA-MM com mês 01..12. */
export function isMonth(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const dayOf = (date: string): number => Number(date.slice(8, 10));
const dateIn = (month: string, d: number): string =>
  `${month}-${String(Math.min(d, daysInMonth(month))).padStart(2, "0")}`;
/** Dias de `from` até `to` (negativo se `to` já passou). */
const diffDays = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** "HOJE", "AMANHÃ" ou "N DIAS". */
export function rotuloDias(dias: number): string {
  if (dias === 0) return "HOJE";
  if (dias === 1) return "AMANHÃ";
  return `${dias} DIAS`;
}

/** Próxima data (hoje inclusive) em que cai o dia `d` do mês; dia 31 vira o último dia em meses curtos. */
export function proximaData(d: number, today: string): string {
  const month = today.slice(0, 7);
  const here = dateIn(month, d);
  return here >= today ? here : dateIn(nextMonth(month), d);
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (part: number, total: number): number => (total > 0 ? round1((part / total) * 100) : 0);

export const SEM_CATEGORIA = "Sem categoria";

// ---------------------------------------------------------------------------
// Cálculos (puros)
// ---------------------------------------------------------------------------

/** Contas que entram no patrimônio: corretora fica de fora (o dinheiro dela já está nos investimentos). */
export const contasVisiveis = (contas: Conta[]): Conta[] => contas.filter((c) => c.tipo !== "corretora");

/** Valor atual de um investimento: cotação × quantidade quando há cotação, senão o custo. */
export function valorInvestimento(i: Investimento): number {
  return i.cotacao !== null && i.quantidade > 0 ? Math.round(i.cotacao * i.quantidade) : i.custo;
}

export type Patrimonio = { total: number; contas: number; investido: number };

export function patrimonio(s: Pick<FinanceSnapshot, "contas" | "investimentos">): Patrimonio {
  const contas = contasVisiveis(s.contas).reduce((a, c) => a + c.saldo, 0);
  const investido = s.investimentos.reduce((a, i) => a + valorInvestimento(i), 0);
  return { total: contas + investido, contas, investido };
}

export type ResumoMes = {
  /** Soma das receitas do mês. */
  entrou: number;
  /** Soma dos gastos do mês. */
  saiu: number;
  sobra: number;
  diasNoMes: number;
  /** Dia de hoje se o mês pedido é o atual; senão null. */
  diaHoje: number | null;
  /** Gasto acumulado por dia (índice 0 = dia 1). Vai até hoje no mês atual, até o fim em mês passado, vazio em mês futuro. */
  acumulado: number[];
  /** Gasto previsto no fim do mês (projeção linear do ritmo até hoje). Só no mês atual. */
  projecao: number | null;
};

export function resumoMes(movs: Movimentacao[], month: string, today: string): ResumoMes {
  const diasNoMes = daysInMonth(month);
  const doMes = movs.filter((m) => m.data.startsWith(`${month}-`));
  const entrou = doMes.filter((m) => m.tipo === "receita").reduce((a, m) => a + m.valor, 0);
  const gastos = doMes.filter((m) => m.tipo === "gasto");
  const saiu = gastos.reduce((a, m) => a + m.valor, 0);
  const current = today.slice(0, 7);
  const diaHoje = month === current ? dayOf(today) : null;
  const ate = month < current ? diasNoMes : month === current ? dayOf(today) : 0;
  const porDia = new Array<number>(diasNoMes).fill(0);
  for (const g of gastos) porDia[dayOf(g.data) - 1] += g.valor;
  const acumulado: number[] = [];
  let soma = 0;
  for (let d = 0; d < ate; d++) {
    soma += porDia[d];
    acumulado.push(soma);
  }
  const projecao = diaHoje !== null ? Math.round((soma / diaHoje) * diasNoMes) : null;
  return { entrou, saiu, sobra: entrou - saiu, diasNoMes, diaHoje, acumulado, projecao };
}

export type CategoriaMes = {
  categoria: string;
  total: number;
  /** Parte do gasto do mês, em % (1 casa). */
  pct: number;
  /** Gasto da mesma categoria no mês anterior; null se o mês anterior não tem nenhum dado. */
  anterior: number | null;
  /** Variação contra o mês anterior, em % (1 casa); null se não há base para comparar. */
  variacao: number | null;
};

const gastosPorCategoria = (movs: Movimentacao[], month: string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const m of movs) {
    if (m.tipo !== "gasto" || !m.data.startsWith(`${month}-`)) continue;
    const k = m.categoria ?? SEM_CATEGORIA;
    out.set(k, (out.get(k) ?? 0) + m.valor);
  }
  return out;
};

export function categoriasMes(movs: Movimentacao[], month: string): CategoriaMes[] {
  const atual = gastosPorCategoria(movs, month);
  const prev = prevMonth(month);
  const temAnterior = movs.some((m) => m.data.startsWith(`${prev}-`));
  const antes = gastosPorCategoria(movs, prev);
  const total = [...atual.values()].reduce((a, v) => a + v, 0);
  return [...atual.entries()]
    .map(([categoria, v]) => {
      const anterior = temAnterior ? (antes.get(categoria) ?? 0) : null;
      return {
        categoria,
        total: v,
        pct: pct(v, total),
        anterior,
        variacao: anterior ? round1(((v - anterior) / anterior) * 100) : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, "pt-BR"));
}

export type CartaoView = Cartao & {
  /** Uso do limite, em %. */
  usoPct: number;
  /** Fatura atual sobre a meta, em %; null sem meta. */
  metaPct: number | null;
  proximoFechamento: string;
  proximoVencimento: string;
  diasVencimento: number;
  /** "HOJE", "AMANHÃ" ou "N DIAS" até o vencimento. */
  rotuloVencimento: string;
};

export function cartoesView(cartoes: Cartao[], today: string): CartaoView[] {
  return cartoes.map((k) => {
    const proximoVencimento = proximaData(k.vencimento, today);
    const diasVencimento = diffDays(today, proximoVencimento);
    return {
      ...k,
      usoPct: pct(k.usado, k.limite),
      metaPct: k.meta !== null && k.meta > 0 ? round1((k.faturaAtual / k.meta) * 100) : null,
      proximoFechamento: proximaData(k.fechamento, today),
      proximoVencimento,
      diasVencimento,
      rotuloVencimento: rotuloDias(diasVencimento),
    };
  });
}

export type ContaFixaStatus = "hoje" | "amanha" | "futuro" | "passou";

export type ContaFixaView = {
  descricao: string;
  valor: number;
  dia: number;
  forma: ContaFixa["forma"];
  /** Data da cobrança no mês pedido (dia 31 vira o último dia em meses curtos). */
  data: string;
  /** Dias de hoje até a cobrança (negativo se já passou). */
  dias: number;
  status: ContaFixaStatus;
  /** "HOJE", "AMANHÃ", "N DIAS" ou, se já passou, "dia N". Nunca "PAGO". */
  rotulo: string;
};

/** Contas fixas ativas no mês pedido: primeiro as que vão vencer (mais perto primeiro), depois as que passaram. */
export function contasFixasView(fixas: ContaFixa[], month: string, today: string): ContaFixaView[] {
  return fixas
    .filter((f) => f.ativa)
    .map((f): ContaFixaView => {
      const data = dateIn(month, f.dia);
      const dias = diffDays(today, data);
      const status: ContaFixaStatus = dias < 0 ? "passou" : dias === 0 ? "hoje" : dias === 1 ? "amanha" : "futuro";
      const rotulo = dias < 0 ? `dia ${dayOf(data)}` : rotuloDias(dias);
      return { descricao: f.descricao, valor: f.valor, dia: f.dia, forma: f.forma, data, dias, status, rotulo };
    })
    .sort((a, b) => {
      const pa = a.dias < 0 ? 1 : 0;
      const pb = b.dias < 0 ? 1 : 0;
      return pa - pb || a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, "pt-BR");
    });
}

export type InvestimentoView = Investimento & { valor: number; temCotacao: boolean };
export type AlocacaoClasse = { classe: Investimento["classe"]; valor: number; pct: number };
export type InvestimentosView = { total: number; rendimentos: number; alocacao: AlocacaoClasse[]; itens: InvestimentoView[] };

export function alocacaoInvest(invs: Investimento[]): InvestimentosView {
  const itens = invs
    .map((i): InvestimentoView => ({ ...i, valor: valorInvestimento(i), temCotacao: i.cotacao !== null && i.quantidade > 0 }))
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.codigo.localeCompare(b.codigo));
  const total = itens.reduce((a, i) => a + i.valor, 0);
  const porClasse = new Map<Investimento["classe"], number>();
  for (const i of itens) porClasse.set(i.classe, (porClasse.get(i.classe) ?? 0) + i.valor);
  const alocacao = [...porClasse.entries()]
    .map(([classe, valor]) => ({ classe, valor, pct: pct(valor, total) }))
    .sort((a, b) => b.valor - a.valor);
  const rendimentos = itens.reduce((a, i) => a + i.rendimentos, 0);
  return { total, rendimentos, alocacao, itens };
}

export type MovView = Movimentacao & {
  categoria: string;
  /** +1 entrada, -1 saída, 0 neutra (transferência entre contas). */
  sinal: 1 | -1 | 0;
};

export function sinalMov(m: Pick<Movimentacao, "tipo" | "valor">): 1 | -1 | 0 {
  switch (m.tipo) {
    case "receita":
    case "resgate":
    case "estorno":
      return 1;
    case "transferencia":
      return 0;
    case "ajuste":
      return m.valor > 0 ? 1 : m.valor < 0 ? -1 : 0;
    default:
      return -1;
  }
}

/** As `n` movimentações mais recentes até o fim do mês pedido (e nunca depois de hoje). */
export function ultimasMov(movs: Movimentacao[], n: number, month: string, today: string): MovView[] {
  const fim = dateIn(month, 31);
  const corte = fim < today ? fim : today;
  return movs
    .filter((m) => m.data <= corte)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .slice(0, n)
    .map((m) => ({ ...m, categoria: m.categoria ?? SEM_CATEGORIA, sinal: sinalMov(m) }));
}

/** Meses com movimentação mais o mês atual, do mais novo para o mais antigo (nunca no futuro). */
export function mesesDisponiveis(movs: Movimentacao[], today: string): string[] {
  const current = today.slice(0, 7);
  const set = new Set<string>([current]);
  for (const m of movs) {
    const mes = m.data.slice(0, 7);
    if (mes <= current) set.add(mes);
  }
  return [...set].sort().reverse();
}

// ---------------------------------------------------------------------------
// Visão completa (o que GET /api/finance devolve)
// ---------------------------------------------------------------------------

export const ULTIMAS_MOV = 10;

export type FinanceView = {
  empty: false;
  generatedAt: string;
  receivedAt: string;
  /** Mês pedido (AAAA-MM). */
  month: string;
  /** Hoje no servidor (AAAA-MM-DD). */
  today: string;
  meses: string[];
  patrimonio: Patrimonio;
  contas: Conta[];
  mes: ResumoMes;
  categorias: CategoriaMes[];
  cartoes: CartaoView[];
  contasFixas: ContaFixaView[];
  investimentos: InvestimentosView;
  movimentacoes: MovView[];
};

export type FinanceEmpty = { empty: true };
export type FinanceResponse = FinanceView | FinanceEmpty;

export type FinanceSyncResult = { ok: true; generatedAt: string; receivedAt: string };

export function buildFinanceView(
  s: FinanceSnapshot,
  opts: { month: string; today: string; receivedAt: string },
): FinanceView {
  const { month, today, receivedAt } = opts;
  return {
    empty: false,
    generatedAt: s.generatedAt,
    receivedAt,
    month,
    today,
    meses: mesesDisponiveis(s.movimentacoes, today),
    patrimonio: patrimonio(s),
    contas: contasVisiveis(s.contas).sort((a, b) => b.saldo - a.saldo),
    mes: resumoMes(s.movimentacoes, month, today),
    categorias: categoriasMes(s.movimentacoes, month),
    cartoes: cartoesView(s.cartoes, today),
    contasFixas: contasFixasView(s.contasFixas, month, today),
    investimentos: alocacaoInvest(s.investimentos),
    movimentacoes: ultimasMov(s.movimentacoes, ULTIMAS_MOV, month, today),
  };
}
