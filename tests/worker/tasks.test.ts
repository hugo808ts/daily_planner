import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayISO, weekStart } from "../../shared/dates";

const BASE = "https://agenda.test";
const call = (method: string, path: string, body?: unknown) =>
  SELF.fetch(BASE + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const post = (path: string, body: unknown) => call("POST", path, body);

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM tasks"), env.DB.prepare("DELETE FROM day_notes")]);
});

const today = () => todayISO();
const yesterday = () => addDays(todayISO(), -1);

async function create(body: Record<string, unknown>) {
  const res = await post("/api/tasks", body);
  return { res, json: (await res.json()) as any };
}
async function week(date: string) {
  return (await (await call("GET", `/api/week?start=${weekStart(date)}`)).json()) as any;
}

describe("POST /api/tasks + GET /api/week", () => {
  it("cria e aparece na semana", async () => {
    const { res, json } = await create({ title: "Estudar", date: today(), time: "09:30", area: "school" });
    expect(res.status).toBe(201);
    expect(json.task).toMatchObject({ title: "Estudar", date: today(), time: "09:30", area: "school", doneAt: null, movedFromId: null });
    expect(typeof json.task.id).toBe("string");
    const w = await week(today());
    expect(w.start).toBe(weekStart(today()));
    expect(w.days).toHaveLength(7);
    expect(w.tasks.map((t: any) => t.id)).toContain(json.task.id);
    expect(w.notes).toEqual([]);
  });

  it("ordena por data, horário (nulos por último) e criação", async () => {
    const d = today();
    await create({ title: "sem hora", date: d });
    await create({ title: "tarde", date: d, time: "15:00" });
    await create({ title: "cedo", date: d, time: "08:00" });
    const w = await week(d);
    expect(w.tasks.map((t: any) => t.title)).toEqual(["cedo", "tarde", "sem hora"]);
  });

  it("normaliza start para a segunda-feira; sem start -> 400", async () => {
    const d = today();
    const w = (await (await call("GET", `/api/week?start=${d}`)).json()) as any;
    expect(w.start).toBe(weekStart(d));
    expect((await call("GET", "/api/week")).status).toBe(400);
  });

  it("data inválida 2026-02-30 -> 400", async () => {
    const { res, json } = await create({ title: "x", date: "2026-02-30" });
    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
    expect(typeof json.fields.date).toBe("string");
  });

  it("título de 161 caracteres -> 400", async () => {
    const { res, json } = await create({ title: "a".repeat(161), date: today() });
    expect(res.status).toBe(400);
    expect(typeof json.fields.title).toBe("string");
  });

  it("horário inválido -> 400", async () => {
    expect((await create({ title: "x", date: today(), time: "9:30" })).res.status).toBe(400);
    expect((await create({ title: "x", date: today(), time: "24:00" })).res.status).toBe(400);
  });

  it("exige JSON", async () => {
    const res = await SELF.fetch(BASE + "/api/tasks", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    expect(res.status).toBe(400);
  });

  it("corpo grande -> 413", async () => {
    const res = await post("/api/tasks", { title: "x", date: today(), pad: "a".repeat(70_000) });
    expect(res.status).toBe(413);
  });
});

describe("PATCH / DELETE", () => {
  it("alterna doneAt", async () => {
    const { json } = await create({ title: "t", date: today() });
    const id = json.task.id;
    const a = (await (await call("PATCH", `/api/tasks/${id}`, { done: true })).json()) as any;
    expect(typeof a.task.doneAt).toBe("string");
    const b = (await (await call("PATCH", `/api/tasks/${id}`, { done: false })).json()) as any;
    expect(b.task.doneAt).toBeNull();
  });

  it("done:true em tarefa já concluída mantém doneAt", async () => {
    const { json } = await create({ title: "t", date: today() });
    const id = json.task.id;
    const a = (await (await call("PATCH", `/api/tasks/${id}`, { done: true })).json()) as any;
    await new Promise((r) => setTimeout(r, 5));
    const b = (await (await call("PATCH", `/api/tasks/${id}`, { done: true })).json()) as any;
    expect(b.task.doneAt).toBe(a.task.doneAt);
  });

  it("PATCH muda a data", async () => {
    const { json } = await create({ title: "t", date: today() });
    const to = addDays(today(), 3);
    const r = (await (await call("PATCH", `/api/tasks/${json.task.id}`, { date: to })).json()) as any;
    expect(r.task.date).toBe(to);
    expect((await week(to)).tasks.map((t: any) => t.id)).toContain(json.task.id);
  });

  it("edita campos e limpa time/area com null", async () => {
    const { json } = await create({ title: "t", date: today(), time: "10:00", area: "work" });
    const r = (await (await call("PATCH", `/api/tasks/${json.task.id}`, { title: "novo", time: null, area: null })).json()) as any;
    expect(r.task).toMatchObject({ title: "novo", time: null, area: null });
  });

  it("404 para id desconhecido", async () => {
    const res = await call("PATCH", "/api/tasks/nope", { done: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tarefa não encontrada." });
    expect((await call("DELETE", "/api/tasks/nope")).status).toBe(404);
  });

  it("DELETE remove", async () => {
    const { json } = await create({ title: "t", date: today() });
    const res = await call("DELETE", `/api/tasks/${json.task.id}`);
    expect(await res.json()).toEqual({ id: json.task.id });
    expect((await week(today())).tasks).toEqual([]);
  });
});

describe("POST /api/tasks/:id/move", () => {
  it("tarefa de hoje: mesma id, nova data, copied:false", async () => {
    const { json } = await create({ title: "t", date: today() });
    const to = addDays(today(), 2);
    const r = (await (await post(`/api/tasks/${json.task.id}/move`, { date: to })).json()) as any;
    expect(r.copied).toBe(false);
    expect(r.task.id).toBe(json.task.id);
    expect(r.task.date).toBe(to);
  });

  it("atrasada de hoje (horário já passou): move sem copiar", async () => {
    const { json } = await create({ title: "t", date: today(), time: "00:00" });
    const to = addDays(today(), 1);
    const r = (await (await post(`/api/tasks/${json.task.id}/move`, { date: to })).json()) as any;
    expect(r.copied).toBe(false);
    expect(r.task).toMatchObject({ id: json.task.id, date: to });
  });

  it("não feita de ontem: copia, original intacto", async () => {
    const { json } = await create({ title: "t", date: yesterday(), time: "10:00" });
    const id = json.task.id;
    const r = (await (await post(`/api/tasks/${id}/move`, { date: today() })).json()) as any;
    expect(r.copied).toBe(true);
    expect(r.task.id).not.toBe(id);
    expect(r.task).toMatchObject({ movedFromId: id, date: today(), title: "t", time: "10:00", doneAt: null });
    const w = await week(yesterday());
    const orig = w.tasks.find((t: any) => t.id === id);
    expect(orig).toMatchObject({ date: yesterday(), doneAt: null });
  });

  it("tarefa concluída -> 409", async () => {
    const { json } = await create({ title: "t", date: yesterday() });
    await call("PATCH", `/api/tasks/${json.task.id}`, { done: true });
    const res = await post(`/api/tasks/${json.task.id}/move`, { date: today() });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Tarefa já concluída." });
  });

  it("404 e 400", async () => {
    expect((await post("/api/tasks/nope/move", { date: today() })).status).toBe(404);
    const { json } = await create({ title: "t", date: today() });
    expect((await post(`/api/tasks/${json.task.id}/move`, { date: "2026-13-01" })).status).toBe(400);
  });
});

describe("PUT /api/day-notes/:date", () => {
  it("grava, aparece na semana e limpa com texto vazio", async () => {
    const d = today();
    const put = await call("PUT", `/api/day-notes/${d}`, { text: "lembrar" });
    expect(await put.json()).toEqual({ note: { date: d, text: "lembrar" } });
    let w = await week(d);
    expect(w.notes).toEqual([{ date: d, text: "lembrar" }]);
    const clr = await call("PUT", `/api/day-notes/${d}`, { text: "" });
    expect(await clr.json()).toEqual({ note: null });
    w = await week(d);
    expect(w.notes).toEqual([]);
  });

  it("valida data e tamanho", async () => {
    expect((await call("PUT", "/api/day-notes/2026-02-30", { text: "x" })).status).toBe(400);
    expect((await call("PUT", `/api/day-notes/${today()}`, { text: "a".repeat(301) })).status).toBe(400);
  });
});
