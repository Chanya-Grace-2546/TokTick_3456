import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

function renderRoute(path: string) { render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); }
const staff: api.AuthUser = { id: 1, name: "Staff", email: "staff@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false };

describe("Staff Queue routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getMe").mockResolvedValue(staff);
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
    vi.spyOn(api, "fetchStaffOwners").mockResolvedValue([]);
    vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
    vi.spyOn(api, "fetchTickets").mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1, noResults: false });
  });
  it("lands IT Staff on the Queue", async () => {
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
  });
  it("permits Administrator direct access without default queue navigation", async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...staff, role: "ADMINISTRATOR" });
    renderRoute("/staff/tickets");
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
  });
  it("rejects a Requester direct route without fetching shared tickets", async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...staff, role: "REQUESTER" });
    renderRoute("/staff/tickets");
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(api.fetchStaffTickets).not.toHaveBeenCalled();
  });
  it("redirects signed-out users to Login", async () => {
    vi.mocked(api.getMe).mockResolvedValue(null);
    renderRoute("/staff/tickets");
    await screen.findByRole("button", { name: /sign in/i });
    expect(api.fetchStaffTickets).not.toHaveBeenCalled();
  });
  it("enforces mandatory password change before Queue access", async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...staff, mustChangePassword: true });
    renderRoute("/staff/tickets");
    await screen.findByLabelText(/confirm new password/i);
    expect(api.fetchStaffTickets).not.toHaveBeenCalled();
  });
  it("clears expired identity and returns to Login on Queue 401", async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce(staff).mockResolvedValue(null);
    vi.mocked(api.fetchStaffTickets).mockRejectedValue(new api.StaffQueueError(401, "UNAUTHENTICATED"));
    renderRoute("/staff/tickets");
    await screen.findByRole("button", { name: /sign in/i });
    expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
  });
});
