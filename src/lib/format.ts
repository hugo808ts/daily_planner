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
