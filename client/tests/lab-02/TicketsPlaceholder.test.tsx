import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TicketsPlaceholder from "../../src/pages/TicketsPlaceholder.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";

function renderScreen() {
  localStorage.setItem(
    "toktickit.devRequester",
    JSON.stringify({ id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" })
  );
  return render(
    <MemoryRouter>
      <RequesterProvider>
        <TicketsPlaceholder />
      </RequesterProvider>
    </MemoryRouter>
  );
}

function emptyResponse() {
  return { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1, noResults: true };
}

describe("TicketsPlaceholder (My Tickets)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows the empty state when the Requester has zero tickets and no filters are set (BR-29)", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue({ ...emptyResponse(), noResults: false });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/don't have any tickets yet/i)).toBeInTheDocument();
    });
  });

  it("shows the no-results state when a search/filter matches nothing (BR-30)", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue(emptyResponse());

    renderScreen();
    await waitFor(() => screen.getByLabelText(/search tickets/i));

    fireEvent.change(screen.getByLabelText(/search tickets/i), {
      target: { value: "nonexistent" },
    });

    await waitFor(() => {
      expect(screen.getByText(/no tickets match your search/i)).toBeInTheDocument();
    });
  });

  it("renders the ticket list when items are returned", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          summary: "Laptop battery drains quickly",
          category: "Hardware",
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      noResults: false,
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
    });
    expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();
  });

  it("shows a safe error state on API failure", async () => {
    vi.spyOn(api, "fetchTickets").mockRejectedValue(new Error("failed"));

    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("Clear Filters is disabled with no active filters, enabled once one is set", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue({ ...emptyResponse(), noResults: false });

    renderScreen();
    await waitFor(() => screen.getByLabelText(/search tickets/i));

    const clearButton = screen.getByRole("button", { name: /clear filters/i });
    expect(clearButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/search tickets/i), { target: { value: "laptop" } });

    await waitFor(() => {
      expect(clearButton).not.toBeDisabled();
    });
  });

  it("clicking Clear Filters resets search and re-fetches with no filters", async () => {
    const fetchSpy = vi.spyOn(api, "fetchTickets").mockResolvedValue({ ...emptyResponse(), noResults: false });

    renderScreen();
    await waitFor(() => screen.getByLabelText(/search tickets/i));

    fireEvent.change(screen.getByLabelText(/search tickets/i), { target: { value: "laptop" } });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ search: "laptop" }));
    });

    // Two "Clear Filters" buttons can coexist once a filter is active: the
    // always-visible toolbar one, and the one inside the no-results state.
    // Either does the same thing — click the toolbar one (first in the DOM).
    fireEvent.click(screen.getAllByRole("button", { name: /clear filters/i })[0]);

    await waitFor(() => {
      expect(screen.getByLabelText(/search tickets/i)).toHaveValue("");
    });
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ search: expect.anything() })
    );
  });

  it("renders a Created Date column alongside Last Updated", async () => {
    const createdAt = new Date("2026-01-15T00:00:00Z").toISOString();
    const updatedAt = new Date("2026-02-20T00:00:00Z").toISOString();

    vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          summary: "Laptop battery drains quickly",
          category: "Hardware",
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          createdAt,
          updatedAt,
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      noResults: false,
    });

    renderScreen();

    await waitFor(() => screen.getByText("TKT-2026-000001"));

    // The sortable column headers use role="button" (for clickability),
    // not the default columnheader role — scoped to the table since the
    // "Sort" dropdown button's label also contains "Created Date".
    const table = screen.getByRole("table");
    expect(within(table).getByRole("button", { name: /created date/i })).toBeInTheDocument();
    expect(screen.getByText(new Date(createdAt).toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByText(new Date(updatedAt).toLocaleDateString())).toBeInTheDocument();
  });

  it("clicking the Created Date header sorts by createdAt", async () => {
    const fetchSpy = vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          summary: "Laptop battery drains quickly",
          category: "Hardware",
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      noResults: false,
    });

    renderScreen();
    await waitFor(() => screen.getByText("TKT-2026-000001"));

    // createdAt/desc is already the default sort state, so the FIRST click
    // on "Created Date" flips it to asc (same column, direction toggles) —
    // it does not re-select "desc", since that's already active.
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /created date/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "createdAt", sortDir: "asc" })
      );
    });

    // The table briefly unmounts (loading state) and remounts on every sort
    // change, so we must re-query it fresh here rather than reuse the
    // reference from before the first click.
    await waitFor(() => screen.getByText("TKT-2026-000001"));
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /created date/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "createdAt", sortDir: "desc" })
      );
    });
  });

  it("Sort button opens a dropdown and selecting a field sorts by it", async () => {
    const fetchSpy = vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [
        {
          id: 1,
          ticketNumber: "TKT-2026-000001",
          summary: "Laptop battery drains quickly",
          category: "Hardware",
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      noResults: false,
    });

    renderScreen();
    await waitFor(() => screen.getByText("TKT-2026-000001"));

    // Default label reflects createdAt/desc before any interaction
    expect(screen.getByRole("button", { name: /sort: created date/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sort: created date/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^ticket no\./i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "ticketNumber" })
      );
    });
    expect(screen.getByRole("button", { name: /sort: ticket no\./i })).toBeInTheDocument();
  });
});
