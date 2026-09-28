import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import { administrator, initialPassword, json, person } from "./helpers/adminClientFixture.js";

// Names define the proposed small client API surface; production exports are
// intentionally absent in this red phase.
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
const payload = { name: person.name, email: person.email, role: person.role, isActive: true, initialPassword };

describe("Issue 7 admin API client", () => {
  it("encodes search and one role and includes session credentials", async () => {
    fetchMock.mockResolvedValue(json({ items: [administrator] }));
    expect(await api.fetchAdminUsers({ search: "name + email@example.test", role: "ADMINISTRATOR" })).toEqual({ items: [administrator] });
    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/api/admin/users");
    expect(Object.fromEntries(url.searchParams)).toEqual({ search: "name + email@example.test", role: "ADMINISTRATOR" });
    expect(options?.credentials).toBe("include");
  });
  it("omits empty filters", async () => {
    fetchMock.mockResolvedValue(json({ items: [] }));
    await api.fetchAdminUsers({ search: "", role: undefined });
    expect(new URL(String(fetchMock.mock.calls[0][0])).search).toBe("");
  });
  it("creates with the documented JSON fields", async () => {
    fetchMock.mockResolvedValue(json(person, 201));
    expect(await api.createAdminUser(payload)).toEqual(person);
    const [input, options] = fetchMock.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe("/api/admin/users");
    expect(options).toMatchObject({ method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(options?.body))).toEqual(payload);
  });
  it("PATCHes only supplied editable fields", async () => {
    fetchMock.mockResolvedValue(json({ ...person, isActive: false }));
    await api.updateAdminUser(2, { isActive: false });
    const [input, options] = fetchMock.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe("/api/admin/users/2");
    expect(options).toMatchObject({ method: "PATCH", credentials: "include" });
    expect(JSON.parse(String(options?.body))).toEqual({ isActive: false });
  });
  it("reissues a password with confirmation and accepts an empty 204 without parsing JSON", async () => {
    const response = new Response(null, { status: 204 });
    const parse = vi.spyOn(response, "json"); fetchMock.mockResolvedValue(response);
    await expect(api.setAdminInitialPassword(2, { initialPassword, confirmPassword: initialPassword })).resolves.toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
    const [input, options] = fetchMock.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe("/api/admin/users/2/initial-password");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(String(options?.body))).toEqual({ initialPassword, confirmPassword: initialPassword });
  });
  for (const [name, call] of [
    ["list", () => api.fetchAdminUsers({})], ["create", () => api.createAdminUser(payload)],
    ["edit", () => api.updateAdminUser(2, { name: "Updated" })],
    ["reset", () => api.setAdminInitialPassword(2, { initialPassword, confirmPassword: initialPassword })],
  ] as const) {
    it.each([[401, "UNAUTHENTICATED"], [403, "FORBIDDEN"], [403, "PASSWORD_CHANGE_REQUIRED"], [409, "EMAIL_ALREADY_EXISTS"], [400, "VALIDATION_FAILED"]] as const)(`${name}: preserves %i %s and field errors`, async (status, code) => {
      fetchMock.mockResolvedValue(json({ error: code, fields: { email: "Check email." } }, status));
      await expect(call()).rejects.toMatchObject({ status, code, fields: { email: "Check email." } });
    });
    it(`${name}: rejects non-JSON server errors with a safe structured fallback`, async () => {
      fetchMock.mockResolvedValue(new Response("PRIVATE_PROXY_DETAILS", { status: 502 }));
      await expect(call()).rejects.toMatchObject({ status: 502 });
    });
    it(`${name}: rejects network failures`, async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(call()).rejects.toThrow();
    });
  }
});
