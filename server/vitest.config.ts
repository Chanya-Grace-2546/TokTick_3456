import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// Read connection settings, never use the development schema in a test worker.
const databaseUrl = process.env.DATABASE_URL ?? loadEnv("test", process.cwd(), "").DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    setupFiles: ["./tests/isolation.setup.ts"],
    env: { DATABASE_URL: databaseUrl ?? "" },
  },
});
