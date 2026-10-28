// Servidor dos testes E2E: D1 local isolado em .wrangler/e2e (apagado antes de cada
// execução, migrações aplicadas) e Vite dev com DEV=true. Nunca usa banco remoto.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.argv[2] ?? process.env.E2E_PORT ?? "5199";
const persistDir = ".wrangler/e2e";

rmSync(persistDir, { recursive: true, force: true });

const migrate = spawnSync(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", "d1", "migrations", "apply", "agenda", "--local", "--persist-to", persistDir],
  { stdio: "inherit", env: { ...process.env, CI: "1" } },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"],
  { stdio: "inherit", env: { ...process.env, AGENDA_E2E_PERSIST: persistDir } },
);
const stop = () => vite.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => process.exit(code ?? 0));
