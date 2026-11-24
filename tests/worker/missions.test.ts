import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const BASE = "http://localhost";
const call = (method: string, path: string, body?: unknown, today?: string) => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (today) headers["X-Test-Today"] = today;
  return SELF.fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};
const j = async (res: Response) => (await res.json()) as any;

/** Uma quinta-feira fixa (semana de 2026-11-09). */
const THU = "2026-11-12";
const WED = "2026-11-11";
const TUE = "2026-11-10";

const create = async (body: Record<string, unknown>, today = TUE) => {
  const res = await call("POST", "/api/missions", body, today);
  return { status: res.status, json: await j(res) };
};
const check = (id: string, date: string, done: boolean, today = THU) =>
  call("PUT", `/api/missions/${id}/checks/${date}`, { done }, today);

describe("sementes", () => {
  it("existem as 2 missões da migração", async () => {
    const v = await j(await call("GET", "/api/missions"));
    expect(v.missions.map((m: any) => [m.title, m.attribute, m.xp])).toEqual([
      ["Ler 10 páginas", "mental", 20],
      ["Meditar 10 min", "espiritual", 10],
    ]);
    expect(v.missions[0]).toMatchObject({ done: false, streak: 0, hasChecks: false, archivedDate: null });
    expect(v.complete).toBe(false);
    expect(v.week).toHaveLength(7);
  });
});

describe("missões", () => {
  beforeEach(async () => {
    await env.DB.batch([env.DB.prepare("DELETE FROM mission_checks"), env.DB.prepare("DELETE FROM missions")]);
  });

  it("CRUD, ordem e limite de 8", async () => {
    const a = await create({ title: "  Ler ", attribute: "mental", xp: 20 });
    expect(a.status).toBe(201);
    expect(a.json.mission).toMatchObject({ title: "Ler", attribute: "mental", xp: 20, position: 0, startDate: TUE, hasChecks: false, streak: 0 });
    const b = (await create({ title: "Correr", attribute: "fisica", xp: 35 })).json.mission;
    expect(b.position).toBe(1);

    expect((await create({ title: "x", attribute: "mental", xp: 15 })).status).toBe(400);
    expect((await create({ title: "x", attribute: "pessoal", xp: 10 })).status).toBe(400);
    expect((await create({ title: "x".repeat(61), attribute: "mental", xp: 10 })).status).toBe(400);

    const ren = await call("PATCH", `/api/missions/${b.id}`, { title: "Correr 5 km", xp: 50 }, TUE);
    expect(ren.status).toBe(200);
    expect((await j(ren)).mission).toMatchObject({ title: "Correr 5 km", xp: 50 });
    expect((await call("PATCH", "/api/missions/nao-existe", { title: "x" })).status).toBe(404);

    const ord = await call("PATCH", "/api/missions/order", { ids: [b.id, a.json.mission.id] }, TUE);
    expect(ord.status).toBe(200);
    expect((await j(ord)).missions.map((m: any) => m.id)).toEqual([b.id, a.json.mission.id]);
    expect((await call("PATCH", "/api/missions/order", { ids: [b.id] }, TUE)).status).toBe(400);

    for (let i = 0; i < 6; i++) expect((await create({ title: `m${i}`, attribute: "espiritual", xp: 5 })).status).toBe(201);
    const over = await create({ title: "nona", attribute: "espiritual", xp: 5 });
    expect(over.status).toBe(409);
    expect(over.json.error).toMatch(/8 missões/);
  });

  it("trava XP e atributo depois da primeira marcação", async () => {
    const m = (await create({ title: "Ler", attribute: "mental", xp: 20 })).json.mission;
    expect((await check(m.id, WED, true)).status).toBe(200);
    const res = await call("PATCH", `/api/missions/${m.id}`, { xp: 50, attribute: "fisica" }, THU);
    expect(res.status).toBe(409);
    const body = await j(res);
    expect(body.error).toBe("Arquive e crie outra para mudar o XP.");
    expect(Object.keys(body.fields).sort()).toEqual(["attribute", "xp"]);
    // Mesmo valor e título continuam valendo.
    const ok = await call("PATCH", `/api/missions/${m.id}`, { title: "Ler 20 páginas", xp: 20 }, THU);
    expect(ok.status).toBe(200);
    expect((await j(ok)).mission).toMatchObject({ title: "Ler 20 páginas", hasChecks: true });
  });

  it("arquivar mantém o check e some do dia seguinte; sem histórico e criada hoje apaga", async () => {
    const m = (await create({ title: "Ler", attribute: "mental", xp: 20 })).json.mission;
    await check(m.id, WED, true);
    const del = await call("DELETE", `/api/missions/${m.id}`, undefined, THU);
    expect(await j(del)).toEqual({ id: m.id, deleted: false });
    const wed = await j(await call("GET", `/api/missions?date=${WED}`, undefined, THU));
    expect(wed.missions).toHaveLength(1);
    expect(wed.missions[0]).toMatchObject({ id: m.id, done: true });
    expect(wed.complete).toBe(true);
    const thu = await j(await call("GET", `/api/missions?date=${THU}`, undefined, THU));
    expect(thu.missions).toHaveLength(0);
    expect((await call("DELETE", `/api/missions/${m.id}`, undefined, THU)).status).toBe(404);
    // Marcação só onde a missão vale.
    expect((await check(m.id, THU, true)).status).toBe(400);

    const fresh = (await create({ title: "Nova", attribute: "fisica", xp: 5 }, THU)).json.mission;
    expect(await j(await call("DELETE", `/api/missions/${fresh.id}`, undefined, THU))).toEqual({ id: fresh.id, deleted: true });
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM missions WHERE id = ?").bind(fresh.id).first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("desfazer o arquivamento só no mesmo dia, com o histórico de volta", async () => {
    const m = (await create({ title: "Ler", attribute: "mental", xp: 20 })).json.mission;
    await check(m.id, WED, true);
    await call("DELETE", `/api/missions/${m.id}`, undefined, THU);
    const back = await call("POST", `/api/missions/${m.id}/restore`, undefined, THU);
    expect(back.status).toBe(200);
    expect((await j(back)).mission).toMatchObject({ id: m.id, archivedDate: null, hasChecks: true });
    const thu = await j(await call("GET", `/api/missions?date=${THU}`, undefined, THU));
    expect(thu.missions.map((x: any) => x.id)).toEqual([m.id]);
    // Ativa de novo: não há o que desfazer.
    expect((await call("POST", `/api/missions/${m.id}/restore`, undefined, THU)).status).toBe(404);
    // Arquivada num dia, desfazer no outro: 409.
    await call("DELETE", `/api/missions/${m.id}`, undefined, THU);
    expect((await call("POST", `/api/missions/${m.id}/restore`, undefined, "2026-11-13")).status).toBe(409);
  });

  it("check em data futura dá 400; data inválida também", async () => {
    const m = (await create({ title: "Ler", attribute: "mental", xp: 20 })).json.mission;
    expect((await check(m.id, "2026-11-13", true)).status).toBe(400);
    expect((await check(m.id, "2026-02-30", true)).status).toBe(400);
    expect((await check("nao-existe", WED, true)).status).toBe(404);
    expect((await call("GET", "/api/missions?date=2026-13-01")).status).toBe(400);
  });

  it("complete, dayStreak, streak e pontinhos da semana com X-Test-Today", async () => {
    const a = (await create({ title: "Ler", attribute: "mental", xp: 20 })).json.mission;
    const b = (await create({ title: "Meditar", attribute: "espiritual", xp: 10 })).json.mission;
    // Terça e quarta cumpridas; quinta (hoje) com 1 de 2.
    for (const d of [TUE, WED]) {
      await check(a.id, d, true);
      await check(b.id, d, true);
    }
    const half = await j(await check(a.id, THU, true));
    expect(half).toMatchObject({ xp: 20, complete: false, dayStreak: 2, mission: { id: a.id, done: true, streak: 3 } });
    // Idempotente.
    expect(await j(await check(a.id, THU, true))).toMatchObject({ xp: 20, complete: false });

    const full = await j(await check(b.id, THU, true));
    expect(full).toMatchObject({ xp: 30, complete: true, dayStreak: 3 });

    const v = await j(await call("GET", "/api/missions", undefined, THU));
    expect(v).toMatchObject({ date: THU, today: THU, complete: true, dayStreak: 3 });
    expect(v.week).toEqual(["dark", "lit", "lit", "lit", "future", "future", "future"]);

    const undo = await j(await check(b.id, THU, false));
    expect(undo).toMatchObject({ xp: 20, complete: false, dayStreak: 2, mission: { done: false, streak: 2 } });
    const v2 = await j(await call("GET", "/api/missions", undefined, THU));
    expect(v2.week[3]).toBe("today");
  });

  it("401 em host de produção (nem o X-Test-Today vale)", async () => {
    const prod = await app.request(
      "https://agenda.test/api/missions",
      { headers: { "X-Test-Today": THU } },
      { DB: env.DB, DEV: "true" } as any,
    );
    expect(prod.status).toBe(401);
  });
});
