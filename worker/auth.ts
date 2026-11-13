import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { MiddlewareHandler } from "hono";
import { isLocalRequest } from "./http";
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
    // DEV só vale em localhost: se vazar para produção, o Access continua valendo.
    if (env.DEV === "true" && isLocalRequest(c)) return next();
    const unauthorized = () => c.json({ error: "Faça login para continuar." }, 401);
    const token = c.req.header("Cf-Access-Jwt-Assertion");
    if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return unauthorized();
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, getJwks(env.ACCESS_TEAM_DOMAIN), {
        issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
        audience: env.ACCESS_AUD,
        algorithms: ["RS256"],
      }));
    } catch {
      return unauthorized();
    }
    const forbidden = () => c.json({ error: "Acesso não permitido." }, 403);
    const isSync = c.req.path === FINANCE_SYNC_PATH;
    if (isServiceToken(payload)) {
      // A chave de serviço do agente só pode enviar o retrato; nada mais.
      const ok = !!env.SYNC_CLIENT_ID && payload.common_name === env.SYNC_CLIENT_ID && isSync && c.req.method === "POST";
      return ok ? next() : forbidden();
    }
    // Usuário (navegador) só lê o Financeiro: quem grava é o agente.
    if (isSync) return forbidden();
    return next();
  };
}

export const FINANCE_SYNC_PATH = "/api/finance/sync";

/**
 * JWT de chave de serviço do Access: sem e-mail, `sub` vazio e `common_name` = Client ID.
 * (`type` não identifica chave de serviço.)
 */
function isServiceToken(p: JWTPayload): p is JWTPayload & { common_name: string } {
  return typeof p.email !== "string" && p.sub === "" && typeof p.common_name === "string";
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
