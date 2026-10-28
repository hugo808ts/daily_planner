import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./index";

type Options = { getJwks?: (teamDomain: string) => JWTVerifyGetKey };

const jwksCache = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export function accessGuard(options: Options = {}): MiddlewareHandler<{ Bindings: Env }> {
  const getJwks = options.getJwks ?? remoteJwks;
  return async (c, next) => {
    const env = c.env;
    if (env.DEV === "true") return next();
    const unauthorized = () => c.json({ error: "Faça login para continuar." }, 401);
    const token = c.req.header("Cf-Access-Jwt-Assertion");
    if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return unauthorized();
    try {
      await jwtVerify(token, getJwks(env.ACCESS_TEAM_DOMAIN), {
        issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
        audience: env.ACCESS_AUD,
      });
    } catch {
      return unauthorized();
    }
    return next();
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function sameOrigin(): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const forbidden = () => c.json({ error: "Origem não permitida." }, 403);
    if (c.req.header("Sec-Fetch-Site") === "cross-site") return forbidden();
    const origin = c.req.header("Origin");
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        // Origin inválida ("null" etc.) é rejeitada abaixo.
      }
      const host = c.req.header("Host") ?? new URL(c.req.url).host;
      if (originHost !== host) return forbidden();
    }
    return next();
  };
}
