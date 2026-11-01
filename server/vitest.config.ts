import { defineConfig } from "vitest/config";
import { randomUUID } from "node:crypto";
import { explicitTestUrl, testRunId } from "./tests/helpers/databaseSafety.mjs";

// Explicit connection only; neither DATABASE_URL nor .env is a fallback.
const url = explicitTestUrl();
const runId = process.env.TOKTICKIT_TEST_RUN_ID ? testRunId() : randomUUID();
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    setupFiles: ["./tests/isolation.setup.ts"],
    env: { TOKTICKIT_TEST_DATABASE_URL: url.toString(), TOKTICKIT_TEST_RUN_ID: runId,
      DATABASE_URL: url.toString() },
  },
});
