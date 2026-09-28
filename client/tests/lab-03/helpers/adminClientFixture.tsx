import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../../src/App.js";
import type { AuthUser } from "../../../src/api.js";

export const administrator: AuthUser = { id: 1, name: "Admin Person", email: "admin@example.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false };
export const person: AuthUser = { id: 2, name: "Alex Requester", email: "alex@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false };
export const inactive: AuthUser = { id: 3, name: "Inactive Staff", email: "inactive@example.test", role: "IT_STAFF", isActive: false, mustChangePassword: true };
export const initialPassword = "NewPerson!123";

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function adminClientFixture(user: AuthUser | null = administrator) {
  const state = { user };
  const list = vi.fn(async (_url: URL) => json({ items: [administrator, person, inactive] }));
  const create = vi.fn(async (body: Record<string, unknown>) => {
    const { initialPassword: _password, ...safeFields } = body;
    return json({ ...person, ...safeFields, id: 4, mustChangePassword: true }, 201);
  });
  const edit = vi.fn(async (id: number, body: Record<string, unknown>) => json({ ...(id === 1 ? administrator : id === 3 ? inactive : person), ...body }));
  const reset = vi.fn(async (_id: number, _body: Record<string, unknown>) => new Response(null, { status: 204 }));
  const me = vi.fn(async () => {
    if (!state.user) return json({ error: "UNAUTHENTICATED" }, 401);
    const { id, name, email, role, mustChangePassword } = state.user;
    return json({ id, name, email, role, mustChangePassword });
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === "/api/auth/me") return me();
    if (url.pathname === "/api/admin/users") return method === "POST" ? create(body) : list(url);
    const match = url.pathname.match(/^\/api\/admin\/users\/(\d+)(\/initial-password)?$/);
    if (match) return match[2] ? reset(Number(match[1]), body) : edit(Number(match[1]), body);
    // Existing role homes remain usable when checking rejected admin access.
    if (url.pathname === "/api/tickets" || url.pathname === "/api/staff/tickets") return json({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1, noResults: false });
    if (["/api/categories", "/api/related-systems", "/api/staff/owners"].includes(url.pathname)) return json([]);
    throw new Error(`Unexpected test request: ${method} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { state, list, create, edit, reset, me, fetchMock };
}

export function renderAdmin(path = "/admin/users") {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}
