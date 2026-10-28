import { Hono } from "hono";
import { z } from "zod";
import { FOLDER_NAME_MAX, FOLDER_NAME_MIN, IDEA_BODY_MAX, IDEA_TITLE_MAX, IDEA_TITLE_MIN } from "../../shared/limits";
import type { Folder, Idea } from "../../shared/types";
import { readBody, type Ctx } from "../http";
import type { Env } from "../index";
import { fetchPreview } from "../preview";

const LINK_URL_MAX = 2048;
const EMOJI_MAX = 8;
const SEARCH_MAX = 50;

type FolderRow = { id: string; name: string; emoji: string | null; created_at: string; open_count: number };
type IdeaRow = {
  id: string;
  folder_id: string;
  title: string;
  body: string;
  link_url: string | null;
  link_title: string | null;
  link_thumb: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
};

const rowToFolder = (r: FolderRow): Folder => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  createdAt: r.created_at,
  openCount: r.open_count,
});
const rowToIdea = (r: IdeaRow): Idea => ({
  id: r.id,
  folderId: r.folder_id,
  title: r.title,
  body: r.body,
  linkUrl: r.link_url,
  linkTitle: r.link_title,
  linkThumb: r.link_thumb,
  pinned: r.pinned === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const FOLDER_SELECT =
  "SELECT f.id, f.name, f.emoji, f.created_at, (SELECT COUNT(*) FROM ideas i WHERE i.folder_id = f.id) AS open_count FROM folders f";

const getFolder = async (db: D1Database, id: string): Promise<Folder | null> => {
  const row = await db.prepare(`${FOLDER_SELECT} WHERE f.id = ?`).bind(id).first<FolderRow>();
  return row ? rowToFolder(row) : null;
};
const getIdea = async (db: D1Database, id: string): Promise<Idea | null> => {
  const row = await db.prepare("SELECT * FROM ideas WHERE id = ?").bind(id).first<IdeaRow>();
  return row ? rowToIdea(row) : null;
};
const folderExists = async (db: D1Database, id: string): Promise<boolean> =>
  (await db.prepare("SELECT 1 AS x FROM folders WHERE id = ?").bind(id).first()) !== null;

const insertIdea = (db: D1Database, i: Idea) =>
  db
    .prepare(
      "INSERT INTO ideas (id, folder_id, title, body, link_url, link_title, link_thumb, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(i.id, i.folderId, i.title, i.body, i.linkUrl, i.linkTitle, i.linkThumb, i.pinned ? 1 : 0, i.createdAt, i.updatedAt)
    .run();

const normalize = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const nameSchema = z
  .string({ error: "Nome inválido." })
  .trim()
  .min(FOLDER_NAME_MIN, "Informe um nome.")
  .max(FOLDER_NAME_MAX, `O nome deve ter no máximo ${FOLDER_NAME_MAX} caracteres.`);
const emojiSchema = z.string({ error: "Emoji inválido." }).max(EMOJI_MAX, "Emoji inválido.");
const titleSchema = z
  .string({ error: "Título inválido." })
  .trim()
  .min(IDEA_TITLE_MIN, "Informe um título.")
  .max(IDEA_TITLE_MAX, `O título deve ter no máximo ${IDEA_TITLE_MAX} caracteres.`);
const bodySchema = z
  .string({ error: "Texto inválido." })
  .max(IDEA_BODY_MAX, `O texto deve ter no máximo ${IDEA_BODY_MAX} caracteres.`);
const linkSchema = z
  .string({ error: "Link inválido." })
  .max(LINK_URL_MAX, "Link grande demais.")
  .refine((s) => {
    try {
      const p = new URL(s).protocol;
      return p === "http:" || p === "https:";
    } catch {
      return false;
    }
  }, "Link inválido (use http ou https).");
const idSchema = z.string({ error: "Valor inválido." }).min(1, "Valor inválido.");

const folderCreate = z.object({ name: nameSchema, emoji: emojiSchema.nullish() });
const folderPatch = z.object({ name: nameSchema.optional(), emoji: emojiSchema.nullable().optional() });
const ideaCreate = z.object({
  folderId: idSchema,
  title: titleSchema,
  body: bodySchema.optional(),
  linkUrl: linkSchema.nullish(),
});
const ideaPatch = z.object({
  title: titleSchema.optional(),
  body: bodySchema.optional(),
  linkUrl: linkSchema.nullable().optional(),
  pinned: z.boolean({ error: "Valor inválido." }).optional(),
  folderId: idSchema.optional(),
});
const ideaRestore = z.object({
  idea: z.object({
    id: idSchema,
    folderId: idSchema,
    title: titleSchema,
    body: bodySchema,
    linkUrl: linkSchema.nullable(),
    linkTitle: z.string({ error: "Valor inválido." }).nullable(),
    linkThumb: z.string({ error: "Valor inválido." }).nullable(),
    pinned: z.boolean({ error: "Valor inválido." }),
    createdAt: idSchema,
    updatedAt: idSchema,
  }),
});

const folderNotFound = (c: Ctx) => c.json({ error: "Pasta não encontrada." }, 404);
const ideaNotFound = (c: Ctx) => c.json({ error: "Ideia não encontrada." }, 404);

export function createIdeaRoutes(fetcher: typeof fetch = (...a) => fetch(...a)) {
  const routes = new Hono<{ Bindings: Env }>();

  routes.get("/api/folders", async (c) => {
    const { results } = await c.env.DB.prepare(`${FOLDER_SELECT} ORDER BY f.name COLLATE NOCASE, f.created_at`).all<FolderRow>();
    return c.json({ folders: results.map(rowToFolder) });
  });

  routes.post("/api/folders", async (c) => {
    const body = await readBody(c, folderCreate);
    if (!body.ok) return body.res;
    const id = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO folders (id, name, emoji, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, body.data.name, body.data.emoji ?? null, new Date().toISOString())
      .run();
    return c.json({ folder: await getFolder(c.env.DB, id) }, 201);
  });

  routes.patch("/api/folders/:id", async (c) => {
    const body = await readBody(c, folderPatch);
    if (!body.ok) return body.res;
    const folder = await getFolder(c.env.DB, c.req.param("id"));
    if (!folder) return folderNotFound(c);
    const name = body.data.name ?? folder.name;
    const emoji = body.data.emoji === undefined ? folder.emoji : body.data.emoji;
    await c.env.DB.prepare("UPDATE folders SET name = ?, emoji = ? WHERE id = ?").bind(name, emoji, folder.id).run();
    return c.json({ folder: { ...folder, name, emoji } });
  });

  routes.delete("/api/folders/:id", async (c) => {
    const id = c.req.param("id");
    // Explicit delete of ideas: does not depend on the FK pragma being on.
    const [, res] = await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM ideas WHERE folder_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id),
    ]);
    if (!res.meta.changes) return folderNotFound(c);
    return c.json({ id });
  });

  routes.get("/api/folders/:id/ideas", async (c) => {
    const id = c.req.param("id");
    if (!(await folderExists(c.env.DB, id))) return folderNotFound(c);
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM ideas WHERE folder_id = ? ORDER BY pinned DESC, updated_at DESC, rowid DESC",
    )
      .bind(id)
      .all<IdeaRow>();
    return c.json({ ideas: results.map(rowToIdea) });
  });

  // Registered before any /api/ideas/:id route.
  routes.get("/api/ideas/search", async (c) => {
    const q = normalize((c.req.query("q") ?? "").trim());
    if (!q) return c.json({ ideas: [] });
    // SQLite has no unaccent; a personal-scale table is filtered in JS.
    const { results } = await c.env.DB.prepare(
      "SELECT i.*, f.name AS folder_name FROM ideas i JOIN folders f ON f.id = i.folder_id ORDER BY i.updated_at DESC, i.rowid DESC",
    ).all<IdeaRow & { folder_name: string }>();
    const ideas = results
      .filter((r) => normalize(r.title).includes(q) || normalize(r.body).includes(q))
      .slice(0, SEARCH_MAX)
      .map((r) => ({ ...rowToIdea(r), folderName: r.folder_name }));
    return c.json({ ideas });
  });

  routes.post("/api/ideas/restore", async (c) => {
    const body = await readBody(c, ideaRestore);
    if (!body.ok) return body.res;
    const idea = body.data.idea;
    if (!(await folderExists(c.env.DB, idea.folderId))) return folderNotFound(c);
    if (await getIdea(c.env.DB, idea.id)) return c.json({ error: "Ideia já existe." }, 409);
    await insertIdea(c.env.DB, idea);
    return c.json({ idea }, 201);
  });

  routes.post("/api/ideas", async (c) => {
    const body = await readBody(c, ideaCreate);
    if (!body.ok) return body.res;
    const d = body.data;
    if (!(await folderExists(c.env.DB, d.folderId))) return folderNotFound(c);
    const linkUrl = d.linkUrl ?? null;
    const preview = linkUrl ? await fetchPreview(linkUrl, fetcher) : { title: null, thumb: null };
    const now = new Date().toISOString();
    const idea: Idea = {
      id: crypto.randomUUID(),
      folderId: d.folderId,
      title: d.title,
      body: d.body ?? "",
      linkUrl,
      linkTitle: preview.title,
      linkThumb: preview.thumb,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    await insertIdea(c.env.DB, idea);
    return c.json({ idea }, 201);
  });

  routes.patch("/api/ideas/:id", async (c) => {
    const body = await readBody(c, ideaPatch);
    if (!body.ok) return body.res;
    const idea = await getIdea(c.env.DB, c.req.param("id"));
    if (!idea) return ideaNotFound(c);
    const p = body.data;
    if (p.folderId !== undefined && !(await folderExists(c.env.DB, p.folderId))) return folderNotFound(c);
    let { linkUrl, linkTitle, linkThumb } = idea;
    if (p.linkUrl !== undefined && p.linkUrl !== idea.linkUrl) {
      linkUrl = p.linkUrl;
      const preview = linkUrl ? await fetchPreview(linkUrl, fetcher) : { title: null, thumb: null };
      linkTitle = preview.title;
      linkThumb = preview.thumb;
    }
    const next: Idea = {
      ...idea,
      folderId: p.folderId ?? idea.folderId,
      title: p.title ?? idea.title,
      body: p.body ?? idea.body,
      pinned: p.pinned ?? idea.pinned,
      linkUrl,
      linkTitle,
      linkThumb,
      updatedAt: new Date().toISOString(),
    };
    await c.env.DB.prepare(
      "UPDATE ideas SET folder_id = ?, title = ?, body = ?, link_url = ?, link_title = ?, link_thumb = ?, pinned = ?, updated_at = ? WHERE id = ?",
    )
      .bind(next.folderId, next.title, next.body, next.linkUrl, next.linkTitle, next.linkThumb, next.pinned ? 1 : 0, next.updatedAt, next.id)
      .run();
    return c.json({ idea: next });
  });

  routes.delete("/api/ideas/:id", async (c) => {
    const idea = await getIdea(c.env.DB, c.req.param("id"));
    if (!idea) return ideaNotFound(c);
    await c.env.DB.prepare("DELETE FROM ideas WHERE id = ?").bind(idea.id).run();
    return c.json({ idea });
  });

  return routes;
}

export const ideaRoutes = createIdeaRoutes();
