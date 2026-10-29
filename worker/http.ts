import type { Context } from "hono";
import { isRealDate, todayISO } from "../shared/dates";
import type { z } from "zod";
import type { Env } from "./index";

const MAX_BODY_BYTES = 64 * 1024;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** O pedido veio de um endereço de desenvolvimento local. */
export const isLocalRequest = (c: Pick<Ctx, "req">): boolean => LOCAL_HOSTS.has(new URL(c.req.url).hostname);

/** Hoje (São Paulo). Só em DEV local, o cabeçalho X-Test-Today troca o dia, para os testes E2E com relógio falso. */
export function serverToday(c: Ctx): string {
  const forced = c.req.header("X-Test-Today");
  if (forced && c.env.DEV === "true" && isLocalRequest(c) && isRealDate(forced)) return forced;
  return todayISO();
}

export type Ctx = Context<{ Bindings: Env }>;

export type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response };

export function badRequest(c: Ctx, error: string, fields?: Record<string, string>): Response {
  return c.json(fields ? { error, fields } : { error }, 400);
}

export async function readBody<S extends z.ZodType>(c: Ctx, schema: S): Promise<Parsed<z.infer<S>>> {
  const fail = (res: Response): Parsed<never> => ({ ok: false, res });
  if (!(c.req.header("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail(badRequest(c, "Envie o corpo como application/json."));
  }
  const declared = Number(c.req.header("Content-Length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(c.json({ error: "Corpo grande demais." }, 413));
  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return fail(c.json({ error: "Corpo grande demais." }, 413));
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(badRequest(c, "JSON inválido."));
  }
  const result = schema.safeParse(raw);
  if (!result.success) return fail(validationError(c, result.error));
  return { ok: true, data: result.data };
}

function validationError(c: Ctx, err: z.ZodError): Response {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "body";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return badRequest(c, "Dados inválidos.", fields);
}
