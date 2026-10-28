import { Hono } from "hono";
import { accessGuard, sameOrigin } from "./auth";

export type Env = {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  DEV?: string;
  AI_MOCK?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};

export const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", sameOrigin());
app.use("/api/*", accessGuard());

app.get("/api/health", (c) => c.json({ ok: true }));

export default { fetch: app.fetch };
