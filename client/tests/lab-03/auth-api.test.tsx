import { afterEach, describe, expect, it, vi } from "vitest";
import { changePassword, checkSystem, fetchCategories, fetchRelatedSystems, getMe, login, logout } from "../../src/api.js";

afterEach(() => vi.unstubAllGlobals());

describe("Lab 3 authentication wire compatibility", () => {
  const user = { id: 7, name: "Requester", email: "requester@example.test", role: "REQUESTER" };
  function respond(body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("reads the login password-change flag outside the safe user object", async () => {
    respond({ user, mustChangePassword: true });
    expect(await login(user.email, "InitialPassword!1")).toEqual({ user: { ...user, isActive: true, mustChangePassword: true } });
  });

  it("reads the unwrapped current user", async () => {
    respond({ ...user, mustChangePassword: false });
    expect(await getMe()).toEqual({ ...user, isActive: true, mustChangePassword: false });
  });

  it("sends password confirmation and accepts the safe current-user response", async () => {
    const fetchMock = respond({ ...user, mustChangePassword: false });
    await changePassword("ChangedPassword!2", "ChangedPassword!2");
    const options = fetchMock.mock.calls[0][1];
    expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body)).toEqual({ newPassword: "ChangedPassword!2", confirmPassword: "ChangedPassword!2" });
  });

  it("accepts an empty logout response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(logout()).resolves.toBeUndefined();
  });

  it.each([fetchCategories, fetchRelatedSystems])("includes the session for reference data (%#)", async fetchReference => {
    const fetchMock = respond([]);
    await expect(fetchReference()).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
  });

  it("includes the session when the system check requests categories", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" })))
      .mockResolvedValueOnce(new Response(JSON.stringify([])));
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkSystem()).resolves.toEqual({ online: true, categories: [] });
    expect(fetchMock.mock.calls[1][1].credentials).toBe("include");
  });
});
