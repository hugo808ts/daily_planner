import { env, SELF } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIdeaRoutes } from "../../worker/routes/ideas";

const BASE = "http://localhost";
const init = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? {} : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const call = (method: string, path: string, body?: unknown) => SELF.fetch(BASE + path, init(method, body));
const j = async (res: Response) => (await res.json()) as any;

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM ideas"), env.DB.prepare("DELETE FROM folders")]);
});

async function folder(name = "Estudos", emoji?: string) {
  return (await j(await call("POST", "/api/folders", { name, emoji }))).folder;
}
async function idea(body: Record<string, unknown>) {
  const res = await call("POST", "/api/ideas", body);
  return { res, json: await j(res) };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const list = async (folderId: string) => (await j(await call("GET", `/api/folders/${folderId}/ideas`))).ideas;

describe("folders", () => {
  it("CRUD com openCount e ordem por nome", async () => {
    const res = await call("POST", "/api/folders", { name: "Zeta", emoji: "📚" });
    expect(res.status).toBe(201);
    const z = (await j(res)).folder;
    expect(z).toMatchObject({ name: "Zeta", emoji: "📚", openCount: 0 });
    const a = await folder("alfa");
    await idea({ folderId: a.id, title: "i1" });
    await idea({ folderId: a.id, title: "i2" });
    const all = await j(await call("GET", "/api/folders"));
    expect(all.folders.map((f: any) => [f.name, f.openCount])).toEqual([["alfa", 2], ["Zeta", 0]]);

    const p = await call("PATCH", `/api/folders/${z.id}`, { name: "Zeta2", emoji: null });
    expect((await j(p)).folder).toMatchObject({ name: "Zeta2", emoji: null });
    expect((await call("PATCH", "/api/folders/nope", { name: "x" })).status).toBe(404);
  });

  it("ordena sem considerar acentos nem caixa", async () => {
    for (const n of ["Zeta", "Água", "Beta", "abacate"]) await folder(n);
    const all = await j(await call("GET", "/api/folders"));
    expect(all.folders.map((f: any) => f.name)).toEqual(["abacate", "Água", "Beta", "Zeta"]);
  });

  it("emoji vazio ou só espaços vira null", async () => {
    const a = (await j(await call("POST", "/api/folders", { name: "A", emoji: "" }))).folder;
    const b = (await j(await call("POST", "/api/folders", { name: "B", emoji: "  " }))).folder;
    expect(a.emoji).toBeNull();
    expect(b.emoji).toBeNull();
    const c = (await j(await call("POST", "/api/folders", { name: "C", emoji: "📚" }))).folder;
    const p = (await j(await call("PATCH", `/api/folders/${c.id}`, { emoji: " " }))).folder;
    expect(p.emoji).toBeNull();
  });

  it("valida nome e emoji", async () => {
    expect((await call("POST", "/api/folders", { name: "  " })).status).toBe(400);
    expect((await call("POST", "/api/folders", { name: "x".repeat(41) })).status).toBe(400);
    expect((await call("POST", "/api/folders", { name: "ok", emoji: "123456789" })).status).toBe(400);
  });

  it("excluir remove as ideias da pasta", async () => {
    const f = await folder();
    const other = await folder("Outra");
    await idea({ folderId: f.id, title: "a" });
    const keep = (await idea({ folderId: other.id, title: "b" })).json.idea;
    expect((await call("DELETE", `/api/folders/${f.id}`)).status).toBe(200);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM ideas").first<{ n: number }>();
    expect(count?.n).toBe(1);
    expect((await call("GET", `/api/folders/${f.id}/ideas`)).status).toBe(404);
    expect((await call("DELETE", `/api/folders/${f.id}`)).status).toBe(404);
    expect((await list(other.id))[0].id).toBe(keep.id);
  });
});

describe("ideas", () => {
  it("cria com defaults; pasta desconhecida -> 404", async () => {
    const f = await folder();
    const { res, json } = await idea({ folderId: f.id, title: "Ideia" });
    expect(res.status).toBe(201);
    expect(json.idea).toMatchObject({ folderId: f.id, title: "Ideia", body: "", linkUrl: null, linkTitle: null, linkThumb: null, pinned: false });
    expect((await idea({ folderId: "nope", title: "x" })).res.status).toBe(404);
  });

  it("valida título, corpo e linkUrl", async () => {
    const f = await folder();
    expect((await idea({ folderId: f.id, title: "" })).res.status).toBe(400);
    expect((await idea({ folderId: f.id, title: "x".repeat(161) })).res.status).toBe(400);
    expect((await idea({ folderId: f.id, title: "x", body: "b".repeat(20_001) })).res.status).toBe(400);
    expect((await idea({ folderId: f.id, title: "x", linkUrl: "javascript:alert(1)" })).res.status).toBe(400);
    expect((await idea({ folderId: f.id, title: "x", linkUrl: "ftp://a.com/x" })).res.status).toBe(400);
    expect((await idea({ folderId: f.id, title: "x", linkUrl: "https://a.com/" + "a".repeat(2048) })).res.status).toBe(400);
    expect((await idea({ folderId: f.id, title: "x", linkUrl: "https://a.com/ok" })).res.status).toBe(201);
  });

  it("lista fixadas primeiro, depois mais recentes", async () => {
    const f = await folder();
    const a = (await idea({ folderId: f.id, title: "A" })).json.idea;
    await sleep(5);
    await idea({ folderId: f.id, title: "B" });
    await sleep(5);
    await idea({ folderId: f.id, title: "C" });
    await call("PATCH", `/api/ideas/${a.id}`, { pinned: true });
    const ideas = await list(f.id);
    expect(ideas.map((i: any) => i.title)).toEqual(["A", "C", "B"]);
    expect(ideas[0].pinned).toBe(true);
  });

  it("PATCH altera campos, move de pasta e valida", async () => {
    const f = await folder();
    const g = await folder("Outra");
    const i = (await idea({ folderId: f.id, title: "A" })).json.idea;
    const r = await call("PATCH", `/api/ideas/${i.id}`, { title: "A2", body: "texto", folderId: g.id });
    expect((await j(r)).idea).toMatchObject({ title: "A2", body: "texto", folderId: g.id });
    expect((await call("PATCH", `/api/ideas/${i.id}`, { folderId: "nope" })).status).toBe(404);
    expect((await call("PATCH", "/api/ideas/nope", { title: "x" })).status).toBe(404);
    expect((await call("PATCH", `/api/ideas/${i.id}`, { title: "" })).status).toBe(400);
  });

  it("DELETE devolve a ideia e restore recria exatamente", async () => {
    const f = await folder();
    const created = (await idea({ folderId: f.id, title: "A", body: "corpo", linkUrl: "https://example.com/x" })).json.idea;
    await call("PATCH", `/api/ideas/${created.id}`, { pinned: true });
    const before = (await list(f.id))[0];
    const del = await call("DELETE", `/api/ideas/${created.id}`);
    expect((await j(del)).idea).toEqual(before);
    expect((await call("DELETE", `/api/ideas/${created.id}`)).status).toBe(404);

    const restored = await call("POST", "/api/ideas/restore", { idea: before });
    expect(restored.status).toBe(201);
    expect((await j(restored)).idea).toEqual(before);
    expect((await list(f.id))[0]).toEqual(before);
  });

  it("restore descarta linkThumb inseguro e rejeita linkTitle longo", async () => {
    const f = await folder();
    const i = (await idea({ folderId: f.id, title: "x" })).json.idea;
    const base = { ...i, id: "r1" };
    const bad = await call("POST", "/api/ideas/restore", { idea: { ...base, linkThumb: "http://x.com/a.jpg" } });
    expect((await j(bad)).idea.linkThumb).toBeNull();
    const long = await call("POST", "/api/ideas/restore", { idea: { ...base, id: "r2", linkThumb: "https://x.com/" + "a".repeat(2048) } });
    expect((await j(long)).idea.linkThumb).toBeNull();
    const good = await call("POST", "/api/ideas/restore", { idea: { ...base, id: "r3", linkThumb: "https://x.com/a.jpg" } });
    expect((await j(good)).idea.linkThumb).toBe("https://x.com/a.jpg");
    const title = await call("POST", "/api/ideas/restore", { idea: { ...base, id: "r4", linkTitle: "t".repeat(301) } });
    expect(title.status).toBe(400);
  });

  it("restore: id existente -> 409, pasta sumiu -> 404, forma inválida -> 400", async () => {
    const f = await folder();
    const i = (await idea({ folderId: f.id, title: "A" })).json.idea;
    expect((await call("POST", "/api/ideas/restore", { idea: i })).status).toBe(409);
    expect((await call("POST", "/api/ideas/restore", { idea: { ...i, id: "novo", folderId: "nope" } })).status).toBe(404);
    expect((await call("POST", "/api/ideas/restore", { idea: { ...i, id: "novo", pinned: "sim" } })).status).toBe(400);
    expect((await call("POST", "/api/ideas/restore", { idea: { title: "x" } })).status).toBe(400);
  });
});

describe("search", () => {
  it("ignora acento e maiúsculas, em título e corpo, com folderName", async () => {
    const f = await folder("Faculdade");
    await idea({ folderId: f.id, title: "Calculo II" });
    await idea({ folderId: f.id, title: "Outra", body: "revisar CÁLCULO amanhã" });
    await idea({ folderId: f.id, title: "Nada" });
    const r = await j(await call("GET", `/api/ideas/search?q=${encodeURIComponent("cálculo")}`));
    expect(r.ideas.map((i: any) => i.title).sort()).toEqual(["Calculo II", "Outra"]);
    expect(r.ideas[0].folderName).toBe("Faculdade");
  });

  it("q vazio -> lista vazia; máximo de 50", async () => {
    const f = await folder();
    expect((await j(await call("GET", "/api/ideas/search?q="))).ideas).toEqual([]);
    const now = new Date().toISOString();
    const stmt = env.DB.prepare("INSERT INTO ideas (id, folder_id, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, '', 0, ?, ?)");
    await env.DB.batch(Array.from({ length: 60 }, (_, n) => stmt.bind(`id${n}`, f.id, `item ${n}`, now, now)));
    const r = await j(await call("GET", "/api/ideas/search?q=item"));
    expect(r.ideas).toHaveLength(50);
  });
});

describe("pré-visualização de link", () => {
  const appWith = (fetcher: typeof fetch) => {
    const a = new Hono<{ Bindings: typeof env }>();
    a.route("/", createIdeaRoutes(fetcher));
    return (method: string, path: string, body?: unknown) => a.request(path, init(method, body), env);
  };
  const ok = vi.fn(async (_u: string) => new Response(JSON.stringify({ title: "Título YT", thumbnail_url: "https://i.ytimg.com/t.jpg" })));

  it("preenche linkTitle/linkThumb ao criar e quando linkUrl muda", async () => {
    const req = appWith(ok as unknown as typeof fetch);
    const f = await folder();
    const created = await j(await req("POST", "/api/ideas", { folderId: f.id, title: "v", linkUrl: "https://youtu.be/abc" }));
    expect(created.idea).toMatchObject({ linkTitle: "Título YT", linkThumb: "https://i.ytimg.com/t.jpg" });
    ok.mockClear();
    await req("PATCH", `/api/ideas/${created.idea.id}`, { title: "outro" });
    expect(ok).not.toHaveBeenCalled();
    const cleared = await j(await req("PATCH", `/api/ideas/${created.idea.id}`, { linkUrl: null }));
    expect(cleared.idea).toMatchObject({ linkUrl: null, linkTitle: null, linkThumb: null });
    const changed = await j(await req("PATCH", `/api/ideas/${created.idea.id}`, { linkUrl: "https://www.youtube.com/watch?v=2" }));
    expect(changed.idea.linkTitle).toBe("Título YT");
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("falha de preview não falha o salvamento", async () => {
    const req = appWith((async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch);
    const f = await folder();
    const res = await req("POST", "/api/ideas", { folderId: f.id, title: "v", linkUrl: "https://www.tiktok.com/@a/video/1" });
    expect(res.status).toBe(201);
    expect((await j(res)).idea).toMatchObject({ linkUrl: "https://www.tiktok.com/@a/video/1", linkTitle: null, linkThumb: null });
  });
});
