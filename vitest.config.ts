import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, remoteBindings: false })],
  test: { include: ["tests/worker/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/shared/**/*.test.ts"] },
});
