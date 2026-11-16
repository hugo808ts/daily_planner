import type { ContaFixa, Investimento } from "../../shared/finance";
import { addDays } from "../../shared/dates";

/* Textos do painel Financeiro (datas, meses e rótulos). Dinheiro: money/moneyParts em format.ts. */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const monthIndex = (month: string) => Number(month.slice(5, 7)) - 1;

/** "2026-11" → "nov" */
export const monthShort = (month: string) => MESES[monthIndex(month)];
/** "2026-11" → "novembro" */
export const monthLong = (month: string) => MESES_LONGOS[monthIndex(month)];

/** "2026-11-09" → "09/11" */
export const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** "hoje", "ontem" ou "07/11" (relativo ao hoje do servidor). */
export function relDay(date: string, today: string): string {
  if (date === today) return "hoje";
  if (date === addDays(today, -1)) return "ontem";
  return ddmm(date);
}

const SP_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const SP_TIME = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Data (AAAA-MM-DD) e hora ("08:30") de um instante ISO, no fuso de São Paulo. */
export function spDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return { date: SP_DATE.format(d), time: SP_TIME.format(d) };
}

/** "hoje às 08:30", "ontem às 21:40" ou "em 05/11 às 10:00". */
export function whenSynced(iso: string, today: string): string {
  const { date, time } = spDateTime(iso);
  const day = relDay(date, today);
  return `${day === ddmm(date) ? `em ${day}` : day} às ${time}`;
}

/** Linha do menu lateral: "Atualizado pelo agente às 08:30" (ou "… em 05/11 às 10:00"). */
export function drawerSyncLabel(iso: string, today: string): string {
  const { date, time } = spDateTime(iso);
  return date === today ? `Atualizado pelo agente às ${time}` : `Atualizado pelo agente em ${ddmm(date)} às ${time}`;
}

export const FORMA_LABEL: Record<ContaFixa["forma"], string> = {
  cartao: "Cartão",
  pix: "Pix",
  debito: "Débito",
  boleto: "Boleto",
};

export const CLASSE_LABEL: Record<Investimento["classe"], string> = {
  fii: "FII",
  acao: "Ações",
  etf: "ETF",
  renda_fixa: "Renda fixa",
  tesouro: "Tesouro",
  cripto: "Cripto",
  outro: "Outros",
};

/** Sigla no quadradinho da lista de investimentos. */
export const CLASSE_SIGLA: Record<Investimento["classe"], string> = {
  fii: "FII",
  acao: "AÇ",
  etf: "ETF",
  renda_fixa: "RF",
  tesouro: "TD",
  cripto: "CR",
  outro: "•",
};

/** "+12,5%" / "−3%" (sinal de menos de verdade). */
export function pctSigned(n: number): string {
  const abs = Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs}%`;
}

/** "31%" sem casa decimal quando inteiro. */
export const pctText = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
