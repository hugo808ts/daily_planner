import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "../../shared/dates";
import { AUDIO_MAX_BYTES } from "../../shared/limits";
import { app, type Env } from "../../worker/index";
import { interpretCapture } from "../../worker/routes/capture";

const BASE = "http://localhost";
const today = todayISO();
const withAI = (run: (...a: any[]) => any): Env => ({ DB: env.DB, DEV: "true", AI: { run } }) as unknown as Env;
const post = (path: string, e: Env, body: BodyInit, type = "application/json") =>
  app.request(BASE + path, { method: "POST", headers: { "Content-Type": type }, body }, e);
const capture = (e: Env, text: string) => post("/api/capture", e, JSON.stringify({ text }));
const j = async (res: Response) => (await res.json()) as any;
const aiReturns = (obj: unknown, asString = false) =>
  withAI(vi.fn().mockResolvedValue({ response: asString ? JSON.stringify(obj) : obj }));

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM ideas"), env.DB.prepare("DELETE FROM folders")]);
  await env.DB.prepare("INSERT INTO folders (id, name, created_at) VALUES ('f1','Estudos','2026-01-01T00:00:00Z')").run();
});

describe("POST /api/capture", () => {
  it("resultado válido da IA tem source ai (objeto ou string)", async () => {
    const raw = { kind: "task", title: "Ligar pro dentista", date: today, time: "09:30", area: "personal", folderId: null, difficulty: "low" };
    for (const asString of [false, true]) {
      const res = await capture(aiReturns(raw, asString), "ligar pro dentista hoje 9h30");
      expect(res.status).toBe(200);
      expect((await j(res)).result).toEqual({ ...raw, source: "ai" });
    }
  });

  it("IA que lança erro cai para regras com 200", async () => {
    const e = withAI(vi.fn().mockRejectedValue(new Error("JSON Mode couldn't be met")));
    const res = await capture(e, "comprar pão");
    expect(res.status).toBe(200);
    expect((await j(res)).result.source).toBe("rules");
  });

  it("sem binding AI cai para regras", async () => {
    const res = await capture({ DB: env.DB, DEV: "true" } as unknown as Env, "comprar pão");
    expect(res.status).toBe(200);
    expect((await j(res)).result.source).toBe("rules");
  });

  it("sanitiza data passada, area e pasta inválidas", async () => {
    const res = await capture(
      aiReturns({ kind: "task", title: "  Estudar  ", date: "2020-01-01", time: "9:30", area: "gym", folderId: "nope" }),
      "estudar",
    );
    expect((await j(res)).result).toEqual({
      kind: "task", title: "Estudar", date: today, time: null, area: null, folderId: null, difficulty: "medium", source: "ai",
    });
  });

  it("dificuldade da IA: válida é mantida; inválida ou ausente vira medium", async () => {
    const base = { kind: "task", title: "x", date: today, time: null, area: null, folderId: null };
    for (const [d, want] of [["high", "high"], ["low", "low"], ["epic", "medium"], [undefined, "medium"], [3, "medium"]] as const) {
      const r = (await j(await capture(aiReturns({ ...base, difficulty: d }), "x"))).result;
      expect(r.difficulty).toBe(want);
    }
  });

  it("regras devolvem dificuldade quando a IA cai", async () => {
    const r = (await j(await capture({ DB: env.DB, DEV: "true" } as unknown as Env, "entregar o relatório amanhã"))).result;
    expect(r).toMatchObject({ source: "rules", difficulty: "high" });
  });

  it("data impossível vira hoje; ideia ignora data/hora e mantém pasta válida", async () => {
    let r = (await j(await capture(aiReturns({ kind: "task", title: "x", date: "2026-02-30", time: null, area: "work", folderId: null }), "x"))).result;
    expect(r.date).toBe(today);
    expect(r.area).toBe("work");
    r = (await j(await capture(aiReturns({ kind: "idea", title: "ideia", date: today, time: "10:00", area: null, folderId: "f1" }), "ideia"))).result;
    expect(r).toMatchObject({ kind: "idea", date: null, time: null, folderId: "f1", source: "ai" });
  });

  it("título vazio cai para regras", async () => {
    const res = await capture(aiReturns({ kind: "task", title: "   ", date: null, time: null, area: null, folderId: null }), "comprar pão");
    expect((await j(res)).result.source).toBe("rules");
  });

  it("AI_MOCK=rules com DEV=true pula a IA e usa as regras", async () => {
    const run = vi.fn();
    const r = (await j(await capture({ DB: env.DB, DEV: "true", AI_MOCK: "rules", AI: { run } } as unknown as Env, "comprar pão"))).result;
    expect(r).toMatchObject({ title: "Comprar pão", source: "rules" });
    expect(run).not.toHaveBeenCalled();
  });

  it("AI_MOCK sem DEV=true não desliga a IA", async () => {
    const run = vi.fn().mockResolvedValue({
      response: { kind: "task", title: "Da IA", date: today, time: null, area: null, folderId: null },
    });
    const r = await interpretCapture({ DB: env.DB, AI_MOCK: "rules", AI: { run } } as unknown as Env, "comprar pão", today, []);
    expect(r.source).toBe("ai");
    expect(run).toHaveBeenCalledOnce();
  });

  it("texto vazio ou longo demais dá 400", async () => {
    const e = aiReturns({});
    const a = await capture(e, "   ");
    expect(a.status).toBe(400);
    expect(await j(a)).toEqual({ error: "Escreva alguma coisa." });
    const long = await capture(e, "a".repeat(501));
    expect(long.status).toBe(400);
    expect(await j(long)).toEqual({
      error: "Use no máximo 500 caracteres.",
      fields: { text: "Use no máximo 500 caracteres." },
    });
  });

  it("resposta da IA sem response ou com JSON malformado cai para regras com 200", async () => {
    for (const e of [withAI(vi.fn().mockResolvedValue({ response: undefined })), withAI(vi.fn().mockResolvedValue({ response: "{nope" }))]) {
      const res = await capture(e, "comprar pão");
      expect(res.status).toBe(200);
      expect((await j(res)).result.source).toBe("rules");
    }
  });
});

describe("POST /api/transcribe", () => {
  it("rejeita tipo que não é áudio com 415", async () => {
    const res = await post("/api/transcribe", aiReturns({}), "oi", "text/plain");
    expect(res.status).toBe(415);
    expect(await j(res)).toEqual({ error: "Envie um arquivo de áudio." });
  });

  it("corpo > 5 MB dá 413", async () => {
    const res = await post("/api/transcribe", aiReturns({}), new Uint8Array(AUDIO_MAX_BYTES + 1), "audio/mp4");
    expect(res.status).toBe(413);
    expect(await j(res)).toEqual({ error: "Áudio longo demais (máx. 60 s)." });
  });

  it("devolve texto aparado e envia base64 + pt", async () => {
    const run = vi.fn().mockResolvedValue({ text: " oi " });
    const res = await post("/api/transcribe", withAI(run), new Uint8Array([1, 2, 3]), "audio/webm");
    expect(res.status).toBe(200);
    expect(await j(res)).toEqual({ text: "oi" });
    expect(run).toHaveBeenCalledWith("@cf/openai/whisper-large-v3-turbo", { audio: "AQID", language: "pt" });
  });

  it("falha do Whisper dá 503", async () => {
    const res = await post("/api/transcribe", withAI(vi.fn().mockRejectedValue(new Error("x"))), new Uint8Array([1]), "audio/mp4");
    expect(res.status).toBe(503);
    expect(await j(res)).toEqual({ error: "Não consegui transcrever agora. Tente escrever." });
  });
});
