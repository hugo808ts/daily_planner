import { addDays } from "./dates";
import type { Area, CaptureResult, Folder } from "./types";

// Lowercase + accent-strip, one output char per input char so indices map back to the original text.
const fold = (s: string): string =>
  s
    .split("")
    .map((c) => c.normalize("NFD")[0].toLowerCase()[0])
    .join("");

const W = (alts: string): RegExp => new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`);
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const AREA_WORDS: Record<Area, string[]> = {
  work: ["trabalho", "reunião", "cliente", "chefe", "gerente", "relatório", "escritório", "expediente"],
  school: ["faculdade", "aula", "prova", "estudar", "estudo", "cálculo", "estatística", "matéria", "tcc", "professor", "atividade"],
  personal: ["namorada", "namorado", "academia", "mercado", "casa", "médico", "dentista", "família", "mãe", "pai", "amigo", "amigos", "jantar", "almoço", "banco"],
};
const AREA_RES = (Object.keys(AREA_WORDS) as Area[]).map((a) => ({ area: a, re: W(AREA_WORDS[a].map(fold).join("|")) }));

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const FILLER = /^(?:(?:tenho que|preciso de|preciso|vou|lembrar de|nao esquecer de)\s+)+/;
const PERIODS: [RegExp, string][] = [
  [W("de manha"), "09:00"],
  [W("a tarde|de tarde"), "15:00"],
  [W("a noite|de noite"), "20:00"],
];

type Span = [number, number];
const pad = (n: number): string => String(n).padStart(2, "0");

function parseTime(n: string, spans: Span[]): string | null {
  const hit = (m: RegExpExecArray | null, h: number, min: number): string | null => {
    if (!m || h > 23 || min > 59) return null;
    spans.push([m.index, m.index + m[0].length]);
    return `${pad(h)}:${pad(min)}`;
  };
  let m = /(?<![a-z0-9])(?:as\s+)?(\d{1,2})[:h](\d{2})(?![a-z0-9])/.exec(n);
  if (m) return hit(m, +m[1], +m[2]);
  m = /(?<![a-z0-9])(?:as\s+)?(\d{1,2})\s*h(?![a-z0-9])/.exec(n);
  if (m) return hit(m, +m[1], 0);
  m = /(?<![a-z0-9])as\s+(\d{1,2})(?![a-z0-9:])/.exec(n);
  if (m) return hit(m, +m[1], 0);
  m = /(?<![a-z0-9])meio[- ]dia(?![a-z0-9])/.exec(n);
  if (m) return hit(m, 12, 0);
  for (const [re, t] of PERIODS) {
    m = re.exec(n);
    if (m) return hit(m, +t.slice(0, 2), 0);
  }
  return null;
}

function parseDate(n: string, today: string, spans: Span[]): string | null {
  const take = (m: RegExpExecArray, d: string): string => {
    spans.push([m.index, m.index + m[0].length]);
    return d;
  };
  let m = W("depois de amanha").exec(n);
  if (m) return take(m, addDays(today, 2));
  m = W("amanha").exec(n);
  if (m) return take(m, addDays(today, 1));
  m = W("hoje").exec(n);
  if (m) return take(m, today);

  m = new RegExp(
    `(?<![a-z0-9])(?:(?:na|no|nesta|neste)\s+)?(?:(?:proxima|proximo)\s+)?(${WEEKDAYS.slice(1).concat(WEEKDAYS[0]).join("|")})(?:-feira)?(?![a-z0-9])`,
  ).exec(n);
  if (m) {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const delta = (WEEKDAYS.indexOf(m[1]) - dow + 7) % 7 || 7;
    return take(m, addDays(today, delta));
  }

  m = /(?<![a-z0-9])dia\s+(\d{1,2})(?![a-z0-9])/.exec(n);
  if (m && +m[1] >= 1 && +m[1] <= 31) {
    const day = +m[1];
    const [y, mo, d] = today.split("-").map(Number);
    for (let off = day > d ? 0 : 1; off < 14; off++) {
      const t = new Date(Date.UTC(y, mo - 1 + off, 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
      if (day <= last) return take(m, `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(day)}`);
    }
  }
  return null;
}

function parseArea(n: string, spans: Span[]): Area | null {
  let best: { area: Area; idx: number } | null = null;
  for (const { area, re } of AREA_RES) {
    const m = re.exec(n);
    if (m && (!best || m.index < best.idx)) best = { area, idx: m.index };
  }
  const phrase = /(?<![a-z0-9])(?:no|na)\s+(?:trabalho|faculdade|escritorio)(?![a-z0-9])/.exec(n);
  if (phrase) spans.push([phrase.index, phrase.index + phrase[0].length]);
  return best?.area ?? null;
}

function buildTitle(text: string, spans: Span[]): string {
  let out = "";
  let pos = 0;
  for (const [s, e] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (s > pos) out += text.slice(pos, s);
    out += " ";
    pos = Math.max(pos, e);
  }
  out += text.slice(pos);
  const clean = (s: string): string => s.replace(/\s+/g, " ").replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "");
  out = clean(out);
  const f = FILLER.exec(fold(out));
  if (f) out = clean(out.slice(f[0].length));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function parseCapture(text: string, today: string, folders: Pick<Folder, "id" | "name">[]): CaptureResult {
  const trimmed = text.trim();
  const prefix = /^ideia\s*:\s*/i.exec(trimmed);
  const body = prefix ? trimmed.slice(prefix[0].length) : trimmed;
  const n = fold(body);
  const spans: Span[] = [];

  if (prefix) {
    const folder = folders.find((f) => W(esc(fold(f.name.trim()))).test(n));
    return {
      kind: "idea",
      title: buildTitle(body, spans) || trimmed,
      date: null,
      time: null,
      area: null,
      folderId: folder?.id ?? null,
      source: "rules",
    };
  }

  const time = parseTime(n, spans);
  const date = parseDate(n, today, spans) ?? today;
  const area = parseArea(n, spans);
  return { kind: "task", title: buildTitle(body, spans) || trimmed, date, time, area, folderId: null, source: "rules" };
}
