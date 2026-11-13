import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { app, type Env } from "../../worker/index";
import { accessGuard, sameOrigin } from "../../worker/auth";

const base = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud123" };
const prod = base as unknown as Env;
const dev = { DEV: "true" } as unknown as Env;

describe("accessGuard", () => {
  it("401 sem JWT quando DEV não está ligado", async () => {
    const res = await app.request("https://agenda.test/api/health", {}, prod);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Faça login para continuar." });
  });

  it("200 com DEV=true em localhost, 127.0.0.1 e [::1]", async () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const res = await app.request(`http://${host}/api/health`, {}, dev);
      expect(res.status).toBe(200);
    }
  });

  it("DEV=true é ignorado fora de localhost (401)", async () => {
    const res = await app.request("https://agenda.test/api/health", {}, dev);
    expect(res.status).toBe(401);
  });

  it("falha fechado (401) sem configuração de Access", async () => {
    const res = await app.request("https://agenda.test/api/health", {}, {} as unknown as Env);
    expect(res.status).toBe(401);
  });

  it("401 com JWT inválido", async () => {
    const res = await app.request(
      "https://agenda.test/api/health",
      { headers: { "Cf-Access-Jwt-Assertion": "lixo" } },
      prod,
    );
    expect(res.status).toBe(401);
  });

  describe("verificação do JWT", () => {
    async function setup() {
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
      const jwks = createLocalJWKSet({ keys: [jwk] });
      const sign = (aud: string, iss = `https://${base.ACCESS_TEAM_DOMAIN}`, exp: string | number = "5m") =>
        new SignJWT({ email: "a@b.c" })
          .setProtectedHeader({ alg: "RS256", kid: "k1" })
          .setIssuer(iss)
          .setAudience(aud)
          .setExpirationTime(exp)
          .sign(privateKey);
      const a = new Hono<{ Bindings: Env }>();
      a.use("/api/*", accessGuard({ getJwks: () => jwks }));
      a.get("/api/x", (c) => c.json({ ok: true }));
      return { a, sign };
    }

    it("aceita JWT válido", async () => {
      const { a, sign } = await setup();
      const res = await a.request(
        "https://agenda.test/api/x",
        { headers: { "Cf-Access-Jwt-Assertion": await sign("aud123") } },
        prod,
      );
      expect(res.status).toBe(200);
    });

    it("rejeita audience errada", async () => {
      const { a, sign } = await setup();
      const res = await a.request(
        "https://agenda.test/api/x",
        { headers: { "Cf-Access-Jwt-Assertion": await sign("outra") } },
        prod,
      );
      expect(res.status).toBe(401);
    });

    it("rejeita issuer errado", async () => {
      const { a, sign } = await setup();
      const res = await a.request(
        "https://agenda.test/api/x",
        { headers: { "Cf-Access-Jwt-Assertion": await sign("aud123", "https://evil.cloudflareaccess.com") } },
        prod,
      );
      expect(res.status).toBe(401);
    });

    it("rejeita token expirado", async () => {
      const { a, sign } = await setup();
      const expired = Math.floor(Date.now() / 1000) - 3600;
      const res = await a.request(
        "https://agenda.test/api/x",
        { headers: { "Cf-Access-Jwt-Assertion": await sign("aud123", undefined, expired) } },
        prod,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("chave de serviço (sincronização do Financeiro)", () => {
    const CLIENT_ID = "abc123.access";
    const withSync = { ...base, SYNC_CLIENT_ID: CLIENT_ID } as unknown as Env;

    async function setup() {
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
      const jwks = createLocalJWKSet({ keys: [jwk] });
      const sign = (claims: Record<string, unknown>, sub?: string) => {
        const t = new SignJWT(claims)
          .setProtectedHeader({ alg: "RS256", kid: "k1" })
          .setIssuer(`https://${base.ACCESS_TEAM_DOMAIN}`)
          .setAudience("aud123")
          .setExpirationTime("5m");
        if (sub !== undefined) t.setSubject(sub);
        return t.sign(privateKey);
      };
      // Carga do JWT de chave de serviço: sem email, sub vazio, common_name = Client ID.
      const service = (commonName = CLIENT_ID) => sign({ common_name: commonName, type: "app" }, "");
      const user = () => sign({ email: "a@b.c", type: "app" }, "user-123");
      const a = new Hono<{ Bindings: Env }>();
      a.use("/api/*", accessGuard({ getJwks: () => jwks }));
      a.post("/api/finance/sync", (c) => c.json({ ok: true }));
      a.get("/api/finance", (c) => c.json({ ok: true }));
      a.get("/api/x", (c) => c.json({ ok: true }));
      const req = async (method: string, path: string, token: string, env: Env = withSync) =>
        a.request(`https://agenda.test${path}`, { method, headers: { "Cf-Access-Jwt-Assertion": token } }, env);
      return { req, service, user };
    }

    it("common_name certo na rota de sync: 200", async () => {
      const { req, service } = await setup();
      expect((await req("POST", "/api/finance/sync", await service())).status).toBe(200);
    });

    it("chave certa fora da rota de sync: 403", async () => {
      const { req, service } = await setup();
      const token = await service();
      for (const [method, path] of [["GET", "/api/finance"], ["GET", "/api/x"], ["GET", "/api/finance/sync"]]) {
        const res = await req(method, path, token);
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Acesso não permitido." });
      }
    });

    it("common_name errado ou SYNC_CLIENT_ID ausente: 403", async () => {
      const { req, service } = await setup();
      expect((await req("POST", "/api/finance/sync", await service("outro.access"))).status).toBe(403);
      expect((await req("POST", "/api/finance/sync", await service(), prod)).status).toBe(403);
    });

    it("JWT de usuário no sync: 403; nas outras rotas continua 200", async () => {
      const { req, user } = await setup();
      const token = await user();
      expect((await req("POST", "/api/finance/sync", token)).status).toBe(403);
      expect((await req("GET", "/api/finance", token)).status).toBe(200);
      expect((await req("GET", "/api/x", token)).status).toBe(200);
    });

    it("DEV em localhost libera o sync sem JWT", async () => {
      const res = await app.request(
        "http://localhost/api/finance/sync",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
        { DEV: "true" } as unknown as Env,
      );
      // Passou da autenticação: o corpo vazio cai na validação.
      expect(res.status).toBe(400);
    });
  });
});

describe("sameOrigin", () => {
  it("403 para POST com Origin de outro site", async () => {
    const res = await app.request(
      "http://localhost/api/health",
      { method: "POST", headers: { Origin: "https://evil.example" } },
      dev,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Origem não permitida." });
  });

  it("passa o guard com Origin igual ao host (404 = rota inexistente)", async () => {
    const res = await app.request(
      "http://localhost/api/health",
      { method: "POST", headers: { Origin: "http://localhost" } },
      dev,
    );
    expect(res.status).toBe(404);
  });

  it("403 com Sec-Fetch-Site cross-site", async () => {
    const res = await app.request(
      "http://localhost/api/health",
      { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } },
      dev,
    );
    expect(res.status).toBe(403);
  });

  it("não restringe GET", async () => {
    const res = await app.request(
      "http://localhost/api/health",
      { headers: { Origin: "https://evil.example" } },
      dev,
    );
    expect(res.status).toBe(200);
  });
});
