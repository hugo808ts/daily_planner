import { parseCapture } from "../shared/rules";
import { isRealDate, weekdayShort } from "../shared/dates";
import type { Area, CaptureResult, Folder } from "../shared/types";
import { DIFFICULTIES, type Difficulty } from "../shared/xp";
import type { Env } from "./index";

const CAPTURE_MODEL = "@cf/meta/llama-3.1-8b-instruct";
export const TRANSCRIBE_MODEL = "@cf/openai/whisper-large-v3-turbo";
const AREAS: readonly string[] = ["work", "school", "personal"];
const TITLE_MAX = 160;

const WEEKDAYS: Record<string, string> = {
  dom: "domingo", seg: "segunda-feira", ter: "terça-feira", qua: "quarta-feira",
  qui: "quinta-feira", sex: "sexta-feira", "sáb": "sábado",
};

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["task", "idea"] },
    title: { type: "string" },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    time: { type: ["string", "null"], description: "HH:MM, 24h" },
    area: { type: ["string", "null"], enum: ["work", "school", "personal", null] },
    folderId: { type: ["string", "null"] },
    difficulty: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["kind", "title", "date", "time", "area", "folderId", "difficulty"],
};

export function sanitize(raw: unknown, today: string, folderIds: Set<string>): CaptureResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== "task" && r.kind !== "idea") return null;
  const title = typeof r.title === "string" ? r.title.trim().slice(0, TITLE_MAX).trim() : "";
  if (!title) return null;
  const isTask = r.kind === "task";
  const date = isTask ? (isRealDate(r.date) && r.date >= today ? r.date : today) : null;
  const time = isTask && typeof r.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : null;
  const area = typeof r.area === "string" && AREAS.includes(r.area) ? (r.area as Area) : null;
  const folderId = typeof r.folderId === "string" && folderIds.has(r.folderId) ? r.folderId : null;
  const difficulty: Difficulty =
    isTask && typeof r.difficulty === "string" && (DIFFICULTIES as readonly string[]).includes(r.difficulty)
      ? (r.difficulty as Difficulty)
      : "medium";
  return { kind: r.kind, title, date, time, area, folderId, difficulty, source: "ai" };
}

export async function interpretWithAI(
  env: Env,
  text: string,
  today: string,
  folders: Pick<Folder, "id" | "name">[],
): Promise<CaptureResult | null> {
  try {
    const weekday = WEEKDAYS[weekdayShort(today)] ?? "";
    const folderList = folders.length ? folders.map((f) => `- ${f.id}: ${f.name}`).join("\n") : "(nenhuma)";
    const system = [
      "Você interpreta uma frase curta em português do Brasil e devolve UM item em JSON.",
      `Hoje é ${weekday}, ${today} (formato AAAA-MM-DD).`,
      'kind: "task" (algo a fazer) ou "idea" (algo a guardar). Ideias nunca têm data nem hora.',
      "Áreas possíveis: work (trabalho), school (escola/estudos), personal (pessoal); use null se não der para saber.",
      "dificuldade: low (rápida/simples), medium (normal), high (grande/importante/prova/entrega); na dúvida medium.",
      `Pastas disponíveis (id: nome); use o id só se a frase citar claramente a pasta, senão null:\n${folderList}`,
      "Datas relativas (amanhã, sexta) devem virar AAAA-MM-DD a partir de hoje. Hora em HH:MM, 24h. title curto, sem data/hora.",
    ].join("\n");
    const result = (await env.AI.run(CAPTURE_MODEL as any, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: SCHEMA },
    } as any)) as { response?: unknown } | undefined;
    let raw = result?.response;
    if (typeof raw === "string") raw = JSON.parse(raw);
    return sanitize(raw, today, new Set(folders.map((f) => f.id)));
  } catch {
    return null;
  }
}

export async function interpret(
  env: Env,
  text: string,
  today: string,
  folders: Pick<Folder, "id" | "name">[],
): Promise<CaptureResult> {
  return (await interpretWithAI(env, text, today, folders)) ?? parseCapture(text, today, folders);
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
