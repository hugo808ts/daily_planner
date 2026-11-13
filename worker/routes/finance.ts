import { Hono } from "hono";
import type { z } from "zod";
import {
  buildFinanceView,
  FinanceSnapshot,
  isMonth,
  type FinanceResponse,
  type FinanceSyncResult,
} from "../../shared/finance";
import { badRequest, serverToday, type Ctx } from "../http";
import type { Env } from "../index";

/** Teto do retrato enviado pelo agente (o leitor padrão para em 64 KiB). Abaixo da linha máxima do D1 (2 MB). */
export const SYNC_MAX_BYTES = 2 * 1024 * 1024;
const MAX_FIELDS = 20;

type SnapshotRow = { generated_at: string; received_at: string; data: string };

const tooLarge = (c: Ctx) => c.json({ error: "Retrato grande demais (máximo de 2 MB)." }, 413);

/** Lê o corpo JSON com teto próprio, parando de ler assim que passa do limite. */
async function readSnapshotJson(c: Ctx): Promise<{ ok: true; raw: unknown } | { ok: false; res: Response }> {
  if (!(c.req.header("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, res: badRequest(c, "Envie o corpo como application/json.") };
  }
  const declared = Number(c.req.header("Content-Length") ?? 0);
  if (declared > SYNC_MAX_BYTES) return { ok: false, res: tooLarge(c) };
  const stream = c.req.raw.body;
  if (!stream) return { ok: false, res: badRequest(c, "Envie o retrato no corpo.") };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > SYNC_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return { ok: false, res: tooLarge(c) };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let off = 0;
  for (const ch of chunks) {
    bytes.set(ch, off);
    off += ch.byteLength;
  }
  try {
    return { ok: true, raw: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, res: badRequest(c, "JSON inválido.") };
  }
}

function invalidSnapshot(c: Ctx, err: z.ZodError): Response {
  const fields: Record<string, string> = {};
  let n = 0;
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "body";
    if (key in fields) continue;
    fields[key] = issue.message;
    if (++n >= MAX_FIELDS) break;
  }
  return badRequest(c, "Retrato inválido.", fields);
}

export const financeRoutes = new Hono<{ Bindings: Env }>();

financeRoutes.post("/api/finance/sync", async (c) => {
  const body = await readSnapshotJson(c);
  if (!body.ok) return body.res;
  const parsed = FinanceSnapshot.safeParse(body.raw);
  if (!parsed.success) return invalidSnapshot(c, parsed.error);
  const snap = parsed.data;
  const receivedAt = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO finance_snapshot (id, generated_at, received_at, data) VALUES (1, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at, received_at = excluded.received_at, data = excluded.data",
  )
    .bind(snap.generatedAt, receivedAt, JSON.stringify(snap))
    .run();
  const result: FinanceSyncResult = { ok: true, generatedAt: snap.generatedAt, receivedAt };
  return c.json(result);
});

financeRoutes.get("/api/finance", async (c) => {
  const today = serverToday(c);
  const month = c.req.query("month") ?? today.slice(0, 7);
  if (!isMonth(month)) return badRequest(c, "Informe month=AAAA-MM.", { month: "Mês inválido (use AAAA-MM)." });
  const row = await c.env.DB.prepare("SELECT generated_at, received_at, data FROM finance_snapshot WHERE id = 1").first<SnapshotRow>();
  if (!row) return c.json({ empty: true } satisfies FinanceResponse);
  // O retrato foi validado na gravação.
  const snap = JSON.parse(row.data) as FinanceSnapshot;
  return c.json(buildFinanceView(snap, { month, today, receivedAt: row.received_at }) satisfies FinanceResponse);
});
