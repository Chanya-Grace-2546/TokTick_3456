import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchStaffOwners,
  fetchStaffTickets,
  StaffQueueError,
  StaffQueueResponse,
} from "../../src/api.js";

const queue: StaffQueueResponse = {
  items: [{
    id: 15,
    ticketNumber: "TKT-2026-000015",
    summary: "Wi-Fi disconnects",
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-18T10:00:00Z",
    category: { id: 4, name: "Network" },
    requester: { id: 2, name: "A Requester", email: "a@example.test" },
    requestedPriority: "MEDIUM",
    itPriority: "HIGH",
    status: "WAITING_FOR_REQUESTER",
    owner: null,
  }],
  page: 2,
  pageSize: 20,
  totalItems: 21,
  totalPages: 2,
};

const fetchMock = vi.fn<typeof fetch>();

function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

describe("Staff Queue API helpers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends every staff query parameter with cookie credentials and preserves the response", async () => {
    respond(queue);
    const result = await fetchStaffTickets({
      search: "A Requester + wifi & email@example.test",
      category: 4,
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      status: "WAITING_FOR_REQUESTER",
      owner: 8,
      sortBy: "itPriority",
      sortDir: "asc",
      page: 2,
      pageSize: 20,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/api/staff/tickets");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: "A Requester + wifi & email@example.test",
      category: "4",
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      status: "WAITING_FOR_REQUESTER",
      owner: "8",
      sortBy: "itPriority",
      sortDir: "asc",
      page: "2",
      pageSize: "20",
    });
    expect(options).toEqual({ credentials: "include" });
    expect(result).toEqual(queue);
  });

  it("leaves defaults to the server and omits empty or undefined filters", async () => {
    for (const params of [{}, { search: "", category: undefined, owner: undefined }]) {
      respond(queue);
      await fetchStaffTickets(params);
      const [input, options] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/staff/tickets");
      expect(url.search).toBe("");
      expect(String(input)).not.toContain("?");
      expect(options).toEqual({ credentials: "include" });
    }
  });

  it.each(["unassigned", "me", 8] as const)("serializes owner %s without changing its meaning", async owner => {
    respond(queue);
    await fetchStaffTickets({ owner });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("owner")).toBe(String(owner));
  });

  it.each([10, 20, 50] as const)("sends page size %i exactly", async pageSize => {
    respond(queue);
    await fetchStaffTickets({ page: 3, pageSize });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: "3", pageSize: String(pageSize) });
  });

  it("retrieves eligible owners from the dedicated endpoint using cookie credentials", async () => {
    const owners = [
      { id: 8, name: "Staff", email: "staff@example.test", role: "IT_STAFF" },
      { id: 9, name: "Admin", email: "admin@example.test", role: "ADMINISTRATOR" },
    ];
    respond(owners);
    expect(await fetchStaffOwners()).toEqual(owners);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, options] = fetchMock.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe("/api/staff/owners");
    expect(new URL(String(input)).search).toBe("");
    expect(options).toEqual({ credentials: "include" });
  });

  for (const [name, load] of [
    ["tickets", () => fetchStaffTickets({})],
    ["owners", () => fetchStaffOwners()],
  ] as const) {
    describe(name, () => {
      it.each([
        [401, "UNAUTHENTICATED"],
        [403, "FORBIDDEN"],
        [403, "PASSWORD_CHANGE_REQUIRED"],
        [500, "UNEXPECTED_ERROR"],
      ] as const)("preserves HTTP %i and %s for UI handling", async (status, error) => {
        respond({ error }, status);
        const result = load();
        await expect(result).rejects.toBeInstanceOf(StaffQueueError);
        await expect(result).rejects.toMatchObject({ status, code: error, fields: {} });
      });

      it("preserves field errors from INVALID_QUERY", async () => {
        const fields = { owner: "Choose an active owner.", pageSize: "Choose 10, 20, or 50." };
        respond({ error: "INVALID_QUERY", fields }, 400);
        await expect(load()).rejects.toMatchObject({ status: 400, code: "INVALID_QUERY", fields });
      });

      it("uses a safe fallback when an HTTP failure is not JSON", async () => {
        fetchMock.mockResolvedValueOnce(new Response("private proxy diagnostics", { status: 502 }));
        await expect(load()).rejects.toMatchObject({ status: 502, code: "LOAD_QUEUE_FAILED", fields: {} });
      });

      it("rejects network failures instead of returning an empty success", async () => {
        const failure = new TypeError("Failed to fetch");
        fetchMock.mockRejectedValueOnce(failure);
        await expect(load()).rejects.toBe(failure);
      });
    });
  }
});
