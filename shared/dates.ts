export const TZ = "America/Sao_Paulo";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function nowParts(now: Date = new Date()): { date: string; time: string } {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function todayISO(now?: Date): string {
  return nowParts(now).date;
}

/** AAAA-MM-DD que existe no calendário (rejeita 2026-13-01 e 2026-02-30). */
export function isRealDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const toUtcNoon = (date: string): Date => new Date(`${date}T12:00:00Z`);
const toISO = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function weekStart(date: string): string {
  const dow = toUtcNoon(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function weekdayShort(date: string): string {
  return SHORT[toUtcNoon(date).getUTCDay()];
}

export function isSunday(date: string): boolean {
  return toUtcNoon(date).getUTCDay() === 0;
}

export function formatDayTitle(date: string, today: string): string {
  if (date === today) return "Hoje";
  if (date === addDays(today, 1)) return "Amanhã";
  if (date === addDays(today, -1)) return "Ontem";
  const d = toUtcNoon(date);
  return `${LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
