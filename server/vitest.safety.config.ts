import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mock-only infrastructure checks. Intentionally excludes all database setup.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "node", setupFiles: [], pool: "forks",
    include: ["tests/helpers/databaseSafety.unit.test.mts", "tests/helpers/migrationRecovery.unit.test.mts"],
    restoreMocks: true, unstubEnvs: true,
  },
});
