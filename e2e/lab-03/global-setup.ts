import { execFileSync } from "child_process";
import * as path from "path";

export default async function globalSetup() {
  const serverDir = path.resolve(__dirname, "..", "..", "server");

  execFileSync(
    "npx",
    ["tsx", "scripts/prepare-e2e-users.ts"],
    {
      cwd: serverDir,
      stdio: "inherit",
      env: process.env,
    }
  );
}
