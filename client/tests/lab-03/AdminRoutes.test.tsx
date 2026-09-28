import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { adminClientFixture, administrator, json, renderAdmin } from "./helpers/adminClientFixture.js";

afterEach(() => vi.unstubAllGlobals());

describe("Issue 7 Administrator routes and navigation (UI-03/08, AC-29)", () => {
  it.each(["/", "/admin/users"])("opens User Management at %s for an Administrator", async path => {
    const fixture = adminClientFixture();
    renderAdmin(path);
    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    await waitFor(() => expect(fixture.list).toHaveBeenCalled());
  });

  it("provides Admin / Users on desktop and mobile without Requester or Staff destinations", async () => {
    adminClientFixture(); renderAdmin("/");
    expect(await screen.findByRole("link", { name: "Admin / Users" })).toHaveAttribute("href", "/admin/users");
    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
    expect(screen.getAllByRole("link", { name: "Admin / Users" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /My Tickets|Create Ticket|Ticket Queue/i })).not.toBeInTheDocument();
  });

  it.each(["REQUESTER", "IT_STAFF"] as const)("shows Forbidden to %s without loading management data or exposing navigation", async role => {
    const fixture = adminClientFixture({ ...administrator, role }); renderAdmin();
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission|forbidden/i);
    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
    expect(screen.queryByRole("link", { name: "Admin / Users" })).not.toBeInTheDocument();
    expect(fixture.list).not.toHaveBeenCalled();
    expect(screen.queryByText("alex@example.test")).not.toBeInTheDocument();
  });

  it("redirects signed-out access to Login without fetching Users", async () => {
    const fixture = adminClientFixture(null); renderAdmin();
    await screen.findByRole("button", { name: /sign in/i });
    expect(fixture.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Admin / Users" })).not.toBeInTheDocument();
  });

  it("enforces mandatory password change and hides desktop/mobile admin navigation", async () => {
    const fixture = adminClientFixture({ ...administrator, mustChangePassword: true }); renderAdmin();
    await screen.findByLabelText(/confirm new password/i);
    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
    expect(fixture.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Admin / Users" })).not.toBeInTheDocument();
  });

  it.each([401, 403])("handles list authentication failure %i through existing auth refresh", async status => {
    const fixture = adminClientFixture();
    fixture.list.mockImplementation(async () => {
      fixture.state.user = status === 401 ? null : { ...administrator, mustChangePassword: true };
      return json({ error: status === 401 ? "UNAUTHENTICATED" : "PASSWORD_CHANGE_REQUIRED" }, status);
    });
    renderAdmin();
    if (status === 401) await screen.findByRole("button", { name: /sign in/i });
    else await screen.findByLabelText(/confirm new password/i);
    expect(fixture.me.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("link", { name: "Admin / Users" })).not.toBeInTheDocument();
  });
});
