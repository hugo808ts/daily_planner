import { Hono } from "hono";
import { accessGuard, sameOrigin } from "./auth";
import { captureRoutes } from "./routes/capture";
import { financeRoutes } from "./routes/finance";
import { ideaRoutes } from "./routes/ideas";
import { reportRoutes } from "./routes/report";
import { taskRoutes } from "./routes/tasks";
import { workoutRoutes } from "./routes/workout";
import { missionRoutes } from "./routes/missions";

export type Env = {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  DEV?: string;
  AI_MOCK?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Client ID da chave de serviço do Access usada pelo Agente Finanças (POST /api/finance/sync). */
  SYNC_CLIENT_ID?: string;
};

export const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", sameOrigin());
app.use("/api/*", accessGuard());

app.onError((e, c) => {
  console.error(e);
  return c.json({ error: "Algo deu errado. Tente de novo." }, 500);
});
app.notFound((c) =>
  c.req.path.startsWith("/api/") ? c.json({ error: "Não encontrado." }, 404) : c.text("Not found", 404),
);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/", taskRoutes);
app.route("/", ideaRoutes);
app.route("/", captureRoutes);
app.route("/", reportRoutes);
app.route("/", financeRoutes);
app.route("/", workoutRoutes);
app.route("/", missionRoutes);

export default { fetch: app.fetch };
