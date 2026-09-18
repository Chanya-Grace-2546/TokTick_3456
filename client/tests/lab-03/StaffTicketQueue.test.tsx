import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";

const ticket = {
  id: 15, ticketNumber: "TKT-2026-000015", summary: "Wi-Fi disconnects",
  createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-18T10:00:00Z",
  category: { id: 4, name: "Network" },
  requester: { id: 4, name: "A Requester", email: "a@example.test" },
  requestedPriority: "MEDIUM", itPriority: "HIGH", status: "WAITING_FOR_REQUESTER", owner: null,
} satisfies api.StaffQueueItem;
const response = { items: [ticket], page: 1, pageSize: 10, totalItems: 21, totalPages: 3 };

function renderQueue() {
  return render(<MemoryRouter><AuthProvider><StaffTicketQueue /></AuthProvider></MemoryRouter>);
}

describe("Staff Ticket Queue (UI-06)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getMe").mockResolvedValue({ id: 1, name: "Staff", email: "staff@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false });
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(response);
    vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 4, name: "Network" }]);
    vi.spyOn(api, "fetchStaffOwners").mockResolvedValue([{ id: 8, name: "IT Staff One", email: "staff1@example.test", role: "IT_STAFF" }]);
  });

  it("renders the documented information in table and mobile cards with read-only scope", async () => {
    renderQueue();
    const table = await screen.findByRole("table", { name: "Ticket Queue" });
    const cards = screen.getByRole("list", { name: "Ticket Queue cards" });
    for (const area of [table, cards]) {
      for (const text of ["TKT-2026-000015", "Wi-Fi disconnects", "A Requester", "Network", "Medium", "High", "Waiting for Requester", "Unassigned"]) {
        expect(within(area).getByText(text)).toBeInTheDocument();
      }
    }
    expect(within(table).getByRole("columnheader", { name: "Requested Priority" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "IT Priority" })).toBeInTheDocument();
    const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[3]).toHaveTextContent("Medium");
    expect(cells[4]).toHaveTextContent("High");
    expect(within(cards).getByText("Requested Priority")).toBeInTheDocument();
    expect(within(cards).getByText("IT Priority")).toBeInTheDocument();
    const pagination = screen.getByRole("navigation", { name: "Queue pagination" });
    expect(within(pagination).getByLabelText("Tickets per page")).toBeInTheDocument();
    for (const name of ["Previous", "Next"]) {
      const button = within(pagination).getByRole("button", { name });
      expect(button).toHaveClass("btn", "btn-sm", "btn-outline-secondary");
      expect(button.parentElement).toHaveClass("w-100", "justify-content-between", "flex-wrap", "gap-2");
    }
    expect(within(pagination).getByText("Page 1 of 3")).toHaveClass("small", "text-muted");
    expect(within(screen.getByRole("region", { name: "Queue controls" })).queryByLabelText("Tickets per page")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(api.fetchStaffTickets).toHaveBeenCalledWith(expect.objectContaining({ sortBy: "updatedAt", sortDir: "desc", page: 1, pageSize: 10 }));
    expect(screen.queryByRole("link", { name: /open|create ticket/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim|reassign|save|post/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/internal notes/i)).not.toBeInTheDocument();
  });

  it("searches and combines every filter using the staff parameter names", async () => {
    renderQueue();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const changes = [
      ["Search tickets", "a@example.test", "search"], ["Category", "4", "category"],
      ["Requested Priority", "LOW", "requestedPriority"], ["IT Priority", "HIGH", "itPriority"],
      ["Status", "REOPENED", "status"], ["Owner", "unassigned", "owner"],
    ];
    for (const [label, value, key] of changes) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ [key]: key === "category" ? 4 : value, page: 1 })));
    }
    expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: "a@example.test", category: 4, requestedPriority: "LOW", itPriority: "HIGH", status: "REOPENED", owner: "unassigned" }));
    for (const value of ["me", "8"]) {
      fireEvent.change(screen.getByLabelText("Owner"), { target: { value } });
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ owner: value === "8" ? 8 : value })));
    }
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith({ sortBy: "updatedAt", sortDir: "desc", page: 1, pageSize: 10 }));
  });

  it("supports six sorts, both directions, pagination and all page sizes", async () => {
    renderQueue();
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
    for (const sortBy of ["ticketNumber", "createdAt", "updatedAt", "requestedPriority", "itPriority", "status"]) {
      fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: sortBy } });
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy, page: 1 })));
    }
    for (const sortDir of ["asc", "desc"]) {
      fireEvent.change(screen.getByLabelText("Sort direction"), { target: { value: sortDir } });
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ sortDir })));
    }
    for (const pageSize of [20,50,10]) {
      fireEvent.change(screen.getByLabelText("Tickets per page"), { target: { value: String(pageSize) } });
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ pageSize, page: 1 })));
    }
  });

  it("resets page when a search/filter/sort/page size changes", async () => {
    renderQueue();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    for (const [label, value] of [["Search tickets", "vpn"], ["Status", "NEW"], ["Sort by", "createdAt"], ["Tickets per page", "20"]]) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      await waitFor(() => expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
    }
  });

  it("distinguishes empty queue from no matching results", async () => {
    vi.mocked(api.fetchStaffTickets).mockResolvedValue({ ...response, items: [], totalItems: 0, totalPages: 1 });
    renderQueue();
    await screen.findByText("No tickets in the queue.");
    fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: "absent" } });
    await screen.findByText("No tickets match your search or filters.");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("shows loading and ignores stale responses", async () => {
    let finish!: (value: api.StaffQueueResponse) => void;
    vi.mocked(api.fetchStaffTickets).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    renderQueue();
    expect(screen.getByRole("status")).toHaveTextContent("Loading tickets");
    fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: "wifi" } });
    await screen.findByRole("table");
    await act(async () => { finish({ ...response, items: [{ ...ticket, summary: "Stale result" }] }); });
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  it("shows safe failure with Retry and preserves search", async () => {
    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(new Error("private database details"));
    renderQueue();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the ticket queue");
    expect(screen.queryByText(/private database/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("table");
  });

  it("shows invalid query field feedback and forbidden without ticket data", async () => {
    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(new api.StaffQueueError(400, "INVALID_QUERY", { owner: "Choose an eligible owner." }));
    renderQueue();
    await screen.findByText("Choose an eligible owner.");
    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(new api.StaffQueueError(403, "FORBIDDEN"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view the ticket queue.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows Owner filter loading failure and retries reference data", async () => {
    vi.mocked(api.fetchStaffOwners).mockRejectedValueOnce(new Error("offline"));
    renderQueue();
    await screen.findByText("Could not load queue filters.");
    fireEvent.click(screen.getByRole("button", { name: "Retry filters" }));
    await waitFor(() => expect(api.fetchStaffOwners).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Could not load queue filters.")).not.toBeInTheDocument());
  });
});
