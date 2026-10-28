import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Testes E2E: D1 local isolado (scripts/e2e-server.mjs), Access desligado e captura só por regras (AI_MOCK).
const e2ePersist = process.env.AGENDA_E2E_PERSIST;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({
      remoteBindings: false,
      ...(e2ePersist ? { persistState: { path: e2ePersist }, config: { vars: { DEV: "true", AI_MOCK: "rules" } } } : {}),
    }),
  ],
});
