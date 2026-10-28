import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        remoteBindings: false,
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ["tests/worker/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/shared/**/*.test.ts"],
      setupFiles: ["./tests/worker/apply-migrations.ts"],
    },
  };
});
