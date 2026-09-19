import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSessionToken, hashSessionToken, SESSION_DURATION_MS, sessionCookieOptions } from "../../src/auth.js";

describe("UNIT-03 session helpers", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("generates distinct opaque tokens containing at least 32 bytes", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).toMatch(/^[a-f0-9]{64,}$/);
    expect(Buffer.from(a, "hex").length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });
  it("hashes deterministically with SHA-256 instead of storing a raw token", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).not.toBe(hashSessionToken(`${token}x`));
  });
  it.each(["test", "production"])("aligns %s cookie expiry with eight hours and required flags", environment => {
    vi.stubEnv("NODE_ENV", environment);
    expect(SESSION_DURATION_MS).toBe(8 * 60 * 60 * 1000);
    expect(sessionCookieOptions()).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: environment === "production", maxAge: SESSION_DURATION_MS });
  });
});
