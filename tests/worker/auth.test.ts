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
