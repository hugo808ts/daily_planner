import { Hono } from "hono";
import { z } from "zod";
import { TRANSCRIBE_MODEL, interpret, toBase64 } from "../ai";
import { todayISO } from "../../shared/dates";
import { parseCapture } from "../../shared/rules";
import type { CaptureResult, Folder } from "../../shared/types";
import { AUDIO_MAX_BYTES, CAPTURE_TEXT_MAX } from "../../shared/limits";
import { readBody } from "../http";
import type { Env } from "../index";

const schema = z.object({
  text: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Escreva alguma coisa.").max(CAPTURE_TEXT_MAX, `Use no máximo ${CAPTURE_TEXT_MAX} caracteres.`)),
});

/** IA, ou só as regras quando DEV=true e AI_MOCK=rules (testes E2E). Os dois flags juntos: nunca em produção. */
export async function interpretCapture(
  env: Env,
  text: string,
  today: string,
  folders: Pick<Folder, "id" | "name">[],
): Promise<CaptureResult> {
  if (env.DEV === "true" && env.AI_MOCK === "rules") return parseCapture(text, today, folders);
  return interpret(env, text, today, folders);
}

export const captureRoutes = new Hono<{ Bindings: Env }>();

captureRoutes.post("/api/capture", async (c) => {
  const body = await readBody(c, schema);
  if (!body.ok) {
    const first = await body.res.clone().json<{ fields?: Record<string, string> }>();
    const msg = first.fields?.text;
    if (!msg) return body.res;
    return c.json(msg === "Escreva alguma coisa." ? { error: msg } : { error: msg, fields: { text: msg } }, 400);
  }
  const { results } = await c.env.DB.prepare("SELECT id, name FROM folders ORDER BY name COLLATE NOCASE").all<{ id: string; name: string }>();
  return c.json({ result: await interpretCapture(c.env, body.data.text, todayISO(), results) });
});

captureRoutes.post("/api/transcribe", async (c) => {
  if (!(c.req.header("Content-Type") ?? "").toLowerCase().startsWith("audio/")) {
    return c.json({ error: "Envie um arquivo de áudio." }, 415);
  }
  const tooLong = () => c.json({ error: "Áudio longo demais (máx. 60 s)." }, 413);
  if (Number(c.req.header("Content-Length") ?? 0) > AUDIO_MAX_BYTES) return tooLong();
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > AUDIO_MAX_BYTES) return tooLong();
  try {
    const out = (await c.env.AI.run(TRANSCRIBE_MODEL as any, { audio: toBase64(bytes), language: "pt" } as any)) as {
      text?: string;
    };
    return c.json({ text: (out.text ?? "").trim() });
  } catch {
    return c.json({ error: "Não consegui transcrever agora. Tente escrever." }, 503);
  }
});
