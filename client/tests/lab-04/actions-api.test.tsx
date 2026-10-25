import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionRequestError, createAction, fetchActions, updateAction } from "../../src/api.js";
import { action, body, page } from "./helpers/actionFixture.js";
afterEach(() => vi.unstubAllGlobals());
describe("Lab 4 Action API contract (AC-01/06/19/43)", () => {
  it("uses the paginated GET envelope and cookie authentication", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(page))); vi.stubGlobal("fetch", fetcher);
    expect(await fetchActions(42, 2)).toEqual(page);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/tickets/42/actions?page=2&pageSize=20"), expect.objectContaining({ credentials: "include", method: "GET" }));
  });
  it("sends the original creation key/body and reads the action envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ action }), { status: 201 })); vi.stubGlobal("fetch", fetcher);
    expect(await createAction(42, body, "request-1")).toEqual({ action });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/tickets/42/actions"), expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "request-1" }, body: JSON.stringify(body), credentials: "include" }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty("performedByUserId");
  });
  it("PATCHes version and editable values without an idempotency header", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ action }))); vi.stubGlobal("fetch", fetcher);
    await updateAction(42, 31, { description: "New", version: 2 });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/tickets/42/actions/31"), expect.objectContaining({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: "New", version: 2 }) }));
  });
  it.each([[401,"UNAUTHENTICATED"],[403,"FORBIDDEN"],[404,"NOT_FOUND"],[409,"STALE_UPDATE"],[409,"IDEMPOTENCY_KEY_EXPIRED"],[422,"INACTIVE_ASSIGNEE"],[500,"UNEXPECTED_ERROR"]])("retains safe typed errors %s/%s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: code, fields: { result: "Required" } }), { status: Number(status) })));
    await expect(fetchActions(42)).rejects.toMatchObject({ status, code, fields: { result: "Required" } });
  });
  it("handles non-JSON server failures safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 500 })));
    await expect(fetchActions(42)).rejects.toBeInstanceOf(ActionRequestError);
  });
});
