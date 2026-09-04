import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
});
