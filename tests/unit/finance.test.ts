import { describe, expect, it } from "vitest";
import {
  alocacaoInvest,
  buildFinanceView,
  cartoesView,
  categoriasMes,
  contasFixasView,
  daysInMonth,
  FinanceSnapshot,
  mesesDisponiveis,
  patrimonio,
  prevMonth,
  proximaData,
  resumoMes,
  rotuloDias,
  ultimasMov,
  type Movimentacao,
} from "../../shared/finance";
import fixture from "../fixtures/finance-snapshot.json";

/** "Hoje" para o qual o retrato de exemplo foi montado. */
const TODAY = "2026-11-09";
const snap = FinanceSnapshot.parse(fixture);

const mov = (data: string, valor: number, tipo: Movimentacao["tipo"] = "gasto", categoria: string | null = "Lazer", id = 1): Movimentacao => ({
  id,
  data,
  descricao: "x",
  valor,
  tipo,
  categoria,
  onde: null,
  parcelaNum: null,
  parcelaTotal: null,
});

describe("datas", () => {
  it("meses, virada de ano e dias no mês", () => {
    expect(prevMonth("2027-01")).toBe("2026-12");
    expect(prevMonth("2026-11")).toBe("2026-10");
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2026-12")).toBe(31);
  });
  it("proximaData inclui hoje, vira o mês e o ano e encurta o dia 31", () => {
    expect(proximaData(9, "2026-11-09")).toBe("2026-11-09");
    expect(proximaData(5, "2026-11-09")).toBe("2026-12-05");
    expect(proximaData(5, "2026-12-20")).toBe("2027-01-05");
    expect(proximaData(31, "2026-02-10")).toBe("2026-02-28");
  });
  it("rotuloDias", () => {
    expect(rotuloDias(0)).toBe("HOJE");
    expect(rotuloDias(1)).toBe("AMANHÃ");
    expect(rotuloDias(6)).toBe("6 DIAS");
  });
});

describe("schema FinanceSnapshot", () => {
  it("aceita o retrato de exemplo", () => {
    expect(FinanceSnapshot.safeParse(fixture).success).toBe(true);
  });
  it("rejeita centavos quebrados, data inexistente e tipo desconhecido", () => {
    const bad = (patch: (s: any) => void) => {
      const s = structuredClone(fixture) as any;
      patch(s);
      return FinanceSnapshot.safeParse(s);
    };
    const r1 = bad((s) => (s.contas[0].saldo = 10.5));
    expect(r1.success).toBe(false);
    expect(r1.error?.issues[0].path).toEqual(["contas", 0, "saldo"]);
    expect(bad((s) => (s.movimentacoes[0].data = "2026-02-30")).success).toBe(false);
    expect(bad((s) => (s.movimentacoes[0].tipo = "doacao")).success).toBe(false);
    expect(bad((s) => (s.generatedAt = "ontem")).success).toBe(false);
    expect(bad((s) => (s.cartoes[0].fechamento = 32)).success).toBe(false);
    expect(bad((s) => delete s.investimentos).success).toBe(false);
  });
});

describe("patrimonio", () => {
  it("contas + investimentos (cotação × quantidade, senão custo)", () => {
    expect(patrimonio(snap)).toEqual({ total: 2_152_057, contas: 1_046_567, investido: 1_105_490 });
  });
  it("conta corretora não entra; retrato vazio dá zero", () => {
    const comCorretora = { ...snap, contas: [...snap.contas, { nome: "Corretora X", instituicao: "X", tipo: "corretora" as const, saldo: 99_999 }] };
    expect(patrimonio(comCorretora).contas).toBe(1_046_567);
    expect(patrimonio({ contas: [], investimentos: [] })).toEqual({ total: 0, contas: 0, investido: 0 });
  });
});

describe("resumoMes", () => {
  it("mês atual: entrou, saiu, sobra, acumulado até hoje e projeção linear", () => {
    const r = resumoMes(snap.movimentacoes, "2026-11", TODAY);
    expect(r).toMatchObject({ entrou: 465_000, saiu: 191_568, sobra: 273_432, diasNoMes: 30, diaHoje: 9 });
    expect(r.acumulado).toHaveLength(9);
    expect(r.acumulado[0]).toBe(28_743);
    expect(r.acumulado[8]).toBe(191_568);
    expect(r.projecao).toBe(638_560); // 191568 / 9 × 30
  });
  it("mês passado: série do mês inteiro, sem projeção", () => {
    const r = resumoMes(snap.movimentacoes, "2026-10", TODAY);
    expect(r).toMatchObject({ entrou: 450_000, saiu: 223_769, diaHoje: null, projecao: null });
    expect(r.acumulado).toHaveLength(31);
    expect(r.acumulado[30]).toBe(223_769);
  });
  it("mês sem dados e mês futuro", () => {
    const vazio = resumoMes(snap.movimentacoes, "2026-08", TODAY);
    expect(vazio).toMatchObject({ entrou: 0, saiu: 0, sobra: 0, projecao: null });
    expect(vazio.acumulado).toEqual(new Array(31).fill(0));
    const futuro = resumoMes(snap.movimentacoes, "2026-12", TODAY);
    expect(futuro.acumulado).toEqual([]);
    const hojeSemGasto = resumoMes([], "2026-11", TODAY);
    expect(hojeSemGasto.projecao).toBe(0);
  });
  it("virada de ano: dia 1 de janeiro", () => {
    const movs = [mov("2026-12-31", 5_000), mov("2027-01-01", 3_100)];
    const r = resumoMes(movs, "2027-01", "2027-01-01");
    expect(r).toMatchObject({ saiu: 3_100, diaHoje: 1, acumulado: [3_100], projecao: 96_100 });
  });
});

describe("categoriasMes", () => {
  it("total, porcentagem e variação contra o mês anterior", () => {
    const cats = categoriasMes(snap.movimentacoes, "2026-11");
    expect(cats[0]).toEqual({ categoria: "Moradia", total: 120_000, pct: 62.6, anterior: 120_000, variacao: 0 });
    expect(cats.find((c) => c.categoria === "Alimentação")).toMatchObject({ total: 36_073, anterior: 48_450, variacao: -25.5 });
    // Categoria nova no mês: anterior 0, sem variação.
    expect(cats.find((c) => c.categoria === "Assinaturas")).toMatchObject({ anterior: 0, variacao: null });
    expect(cats.reduce((a, c) => a + c.total, 0)).toBe(191_568);
  });
  it("mês anterior inexistente: anterior e variação null", () => {
    const cats = categoriasMes(snap.movimentacoes, "2026-10");
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c) => c.anterior === null && c.variacao === null)).toBe(true);
  });
  it("mês sem dados: lista vazia; sem categoria vira 'Sem categoria'", () => {
    expect(categoriasMes(snap.movimentacoes, "2026-08")).toEqual([]);
    expect(categoriasMes([mov("2026-11-02", 100, "gasto", null)], "2026-11")[0].categoria).toBe("Sem categoria");
  });
  it("virada de ano compara janeiro com dezembro", () => {
    const movs = [mov("2026-12-10", 10_000), mov("2027-01-05", 15_000)];
    expect(categoriasMes(movs, "2027-01")[0]).toMatchObject({ total: 15_000, anterior: 10_000, variacao: 50 });
  });
});

describe("cartoesView", () => {
  it("próximo vencimento relativo a hoje, uso e meta", () => {
    const [b, a] = cartoesView(snap.cartoes, TODAY);
    expect(b).toMatchObject({
      nome: "Banco B crédito",
      proximoVencimento: "2026-11-10",
      diasVencimento: 1,
      rotuloVencimento: "AMANHÃ",
      proximoFechamento: "2026-12-03",
      usoPct: 36.6,
      metaPct: 82,
    });
    expect(a).toMatchObject({ proximoVencimento: "2026-12-05", rotuloVencimento: "26 DIAS", metaPct: null });
    expect(cartoesView(snap.cartoes, "2026-11-10")[0].rotuloVencimento).toBe("HOJE");
  });
});

describe("contasFixasView", () => {
  it("HOJE, AMANHÃ, N DIAS e 'dia N' para as que passaram; inativas fora", () => {
    const v = contasFixasView(snap.contasFixas, "2026-11", TODAY);
    expect(v.map((f) => [f.descricao, f.rotulo, f.status])).toEqual([
      ["Streaming", "HOJE", "hoje"],
      ["Academia", "AMANHÃ", "amanha"],
      ["Internet", "6 DIAS", "futuro"],
      ["Celular", "11 DIAS", "futuro"],
      ["Aluguel", "dia 5", "passou"],
    ]);
    expect(v.some((f) => f.rotulo.includes("PAGO"))).toBe(false);
  });
  it("mês passado: todas passaram; dia 31 em fevereiro cai no dia 28", () => {
    const v = contasFixasView(snap.contasFixas, "2026-10", TODAY);
    expect(v.every((f) => f.status === "passou")).toBe(true);
    const fev = contasFixasView([{ descricao: "X", valor: 1, dia: 31, forma: "pix", ativa: true }], "2026-02", "2026-02-27");
    expect(fev[0]).toMatchObject({ data: "2026-02-28", rotulo: "AMANHÃ" });
  });
});

describe("alocacaoInvest", () => {
  it("participação por classe; sem cotação usa o custo", () => {
    const inv = alocacaoInvest(snap.investimentos);
    expect(inv.total).toBe(1_105_490);
    expect(inv.rendimentos).toBe(5_280);
    expect(inv.itens.map((i) => i.codigo)).toEqual(["TESOURO SELIC 2029", "CDB 110% CDI", "IVVB11", "KNSC11"]);
    expect(inv.itens.find((i) => i.codigo === "KNSC11")).toMatchObject({ valor: 109_440, temCotacao: true });
    expect(inv.itens.find((i) => i.codigo === "TESOURO SELIC 2029")).toMatchObject({ valor: 520_000, temCotacao: false });
    expect(inv.alocacao.map((a) => a.classe)).toEqual(["tesouro", "renda_fixa", "etf", "fii"]);
    expect(inv.alocacao[0].pct).toBe(47);
    expect(alocacaoInvest([])).toEqual({ total: 0, rendimentos: 0, alocacao: [], itens: [] });
  });
});

describe("ultimasMov", () => {
  it("as N mais recentes até o fim do mês pedido, com sinal", () => {
    const u = ultimasMov(snap.movimentacoes, 10, "2026-11", TODAY);
    expect(u).toHaveLength(10);
    expect(u[0]).toMatchObject({ id: 33, sinal: 0, categoria: "Sem categoria" });
    expect(u[1]).toMatchObject({ id: 32, sinal: -1, categoria: "Assinaturas" });
    expect(u.find((m) => m.id === 30)?.sinal).toBe(1);
    const out = ultimasMov(snap.movimentacoes, 3, "2026-10", TODAY);
    expect(out.map((m) => m.id)).toEqual([12, 11, 10]);
    expect(out[0].sinal).toBe(1); // estorno
  });
  it("não mostra parcela com data futura", () => {
    const u = ultimasMov([mov("2026-11-20", 1, "gasto", "Compras", 2), mov("2026-11-01", 1)], 10, "2026-11", TODAY);
    expect(u.map((m) => m.id)).toEqual([1]);
  });
});

describe("mesesDisponiveis", () => {
  it("mês atual + meses com dados, mais novo primeiro, sem futuro", () => {
    expect(mesesDisponiveis(snap.movimentacoes, TODAY)).toEqual(["2026-11", "2026-10"]);
    expect(mesesDisponiveis(snap.movimentacoes, "2027-01-02")).toEqual(["2027-01", "2026-11", "2026-10"]);
    expect(mesesDisponiveis([mov("2026-12-01", 1)], TODAY)).toEqual(["2026-11"]);
    expect(mesesDisponiveis([], TODAY)).toEqual(["2026-11"]);
  });
});

describe("buildFinanceView", () => {
  it("monta a visão completa", () => {
    const v = buildFinanceView(snap, { month: "2026-11", today: TODAY, receivedAt: "2026-11-09T11:31:00.000Z" });
    expect(v).toMatchObject({ empty: false, generatedAt: snap.generatedAt, month: "2026-11", today: TODAY });
    expect(v.contas.map((c) => c.saldo)).toEqual([800_000, 234_567, 12_000]);
    expect(v.movimentacoes).toHaveLength(10);
    expect(v.categorias[0].categoria).toBe("Moradia");
  });
});
