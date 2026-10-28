import { formatDayTitle, weekdayShort } from "../../shared/dates";
import type { TaskStatus } from "../../shared/status";
import type { Area } from "../../shared/types";

export const AREAS: { value: Area; label: string; emoji: string }[] = [
  { value: "work", label: "Trabalho", emoji: "💼" },
  { value: "school", label: "Faculdade", emoji: "📚" },
  { value: "personal", label: "Pessoal", emoji: "❤️" },
];

export const areaInfo = (area: Area) => AREAS.find((a) => a.value === area)!;

/** "14:00" → "14h", "08:30" → "8h30". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

export const dayNumber = (date: string): number => Number(date.slice(8, 10));

/** "sex 30" — rótulo curto de um dia. */
export const shortDay = (date: string): string => `${weekdayShort(date)} ${dayNumber(date)}`;

/** "quarta-feira, 28 de outubro" */
export function longDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "hoje", "amanhã", "sexta, 30 out" — para frases como "Levada para …". */
export const dayPhrase = (date: string, today: string): string => formatDayTitle(date, today).toLowerCase();

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Ordem dos pontinhos e segmentos: feitas, depois as vermelhas, depois pendentes. */
export const STATUS_ORDER: Record<TaskStatus, number> = { done: 0, overdue: 1, not_done: 1, pending: 2 };

/** "ontem" / "hoje" / "amanhã" ou "em sexta, 30 out". */
export function onDay(date: string, today: string): string {
  const phrase = dayPhrase(date, today);
  return phrase.includes(",") ? `em ${phrase}` : phrase;
}

/** "https://www.tiktok.com/@x/video/1" → "tiktok.com"; null se não for um link. */
export function linkHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** A capa só é usada se for https (o servidor ainda não valida esse campo). */
export function safeThumb(thumb: string | null): string | null {
  if (!thumb) return null;
  try {
    return new URL(thumb).protocol === "https:" ? thumb : null;
  } catch {
    return null;
  }
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });

/** "28 out" */
export const dayMonth = (iso: string): string => shortDate.format(new Date(iso)).replace(".", "").replace(" de ", " ");

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", "há 2 semanas" ou "12 out". */
export function ago(iso: string, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  if (d < 28) return `há ${Math.floor(d / 7)} ${d < 14 ? "semana" : "semanas"}`;
  return dayMonth(iso);
}

/** Links http(s) soltos num texto, sem repetir. */
export function findLinks(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(found.map((u) => u.replace(/[.,;:!?]+$/, "")))];
}
