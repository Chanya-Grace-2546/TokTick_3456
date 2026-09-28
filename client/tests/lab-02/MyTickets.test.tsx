import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import TicketsPlaceholder from "../../src/pages/MyTickets.js";
import * as api from "../../src/api.js";

function renderScreen() {
  return render(
    <MemoryRouter>
      <TicketsPlaceholder />
    </MemoryRouter>
  );
}

function emptyResponse() {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
    noResults: true,
  };
}

describe("TicketsPlaceholder (My Tickets)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const cardTicket: api.TicketListItem = {
    id: 12,
    ticketNumber: "TKT-2026-000012",
    summary: "Cannot access the shared drive",
    category: "Account and Access",
    requestedPriority: "HIGH",
    itPriority: "MEDIUM",
    currentStatus: "WAITING_FOR_REQUESTER",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-02-20T10:00:00Z",
  };

  function mockCardTickets() {
    return vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [cardTicket], page: 1, pageSize: 10,
      totalItems: 1, totalPages: 1, noResults: false,
    });
  }

  it("keeps the desktop table and provides cards below the lg breakpoint with all seven fields", async () => {
    mockCardTickets();
    renderScreen();

    const table = await screen.findByRole("table");
    expect(table.parentElement).toHaveClass("table-responsive", "d-none", "d-lg-block");
    const cards = screen.getByRole("list", { name: "My Tickets cards" });
    expect(cards).toHaveClass("d-lg-none");
    expect(within(cards).getAllByRole("listitem")).toHaveLength(1);
    const card = within(cards).getByRole("link", { name: `View ticket ${cardTicket.ticketNumber}` });
    expect(card).toHaveAttribute("href", "/tickets/12");
    for (const text of [
      cardTicket.ticketNumber, cardTicket.summary, cardTicket.category,
      cardTicket.requestedPriority, cardTicket.currentStatus,
      new Date(cardTicket.createdAt).toLocaleDateString(),
      new Date(cardTicket.updatedAt).toLocaleDateString(),
    ]) {
      expect(within(card).getByText(text)).toBeInTheDocument();
      expect(within(table).getByText(text)).toBeInTheDocument();
    }
    for (const field of ["Ticket Number", "Summary", "Category", "Requested Priority", "Status", "Created Date", "Last Updated"]) {
      expect(within(card).getByText(field)).toBeInTheDocument();
    }
    expect(within(card).getByText("HIGH")).toHaveClass("badge");
    expect(within(card).getByText("HIGH")).toHaveStyle({ backgroundColor: "#B3261E" });
  });

  it("keeps each ticket in a separate card and preserves full long content", async () => {
    const longTicket = {
      ...cardTicket, id: 13, ticketNumber: "TKT-" + "1234567890".repeat(12),
      summary: "LongSummary".repeat(25), category: "LongCategory".repeat(15),
      currentStatus: "LONG_STATUS_".repeat(10),
    };
    vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [cardTicket, longTicket], page: 1, pageSize: 10,
      totalItems: 2, totalPages: 1, noResults: false,
    });
    renderScreen();
    const cards = await screen.findByRole("list", { name: "My Tickets cards" });
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
    const longCard = within(cards).getByRole("link", { name: `View ticket ${longTicket.ticketNumber}` });
    for (const text of [longTicket.ticketNumber, longTicket.summary, longTicket.category, longTicket.currentStatus]) {
      expect(within(longCard).getByText(text)).toBeInTheDocument();
    }
    expect(longCard).toHaveStyle({ overflowWrap: "anywhere", minWidth: "0" });
  });

  it.each(["desktop row", "card", "keyboard card"])("opens the same Ticket Detail route from the %s", async mode => {
    mockCardTickets();
    render(<MemoryRouter initialEntries={["/tickets"]}>
      <Routes>
        <Route path="/tickets" element={<TicketsPlaceholder />} />
        <Route path="/tickets/12" element={<h1>Ticket Detail destination</h1>} />
      </Routes>
    </MemoryRouter>);
    const table = await screen.findByRole("table");
    if (mode === "desktop row") {
      fireEvent.click(within(table).getByText(cardTicket.ticketNumber));
    } else {
      const link = within(screen.getByRole("list", { name: "My Tickets cards" }))
        .getByRole("link", { name: `View ticket ${cardTicket.ticketNumber}` });
      if (mode === "keyboard card") {
        link.focus();
        await userEvent.setup().keyboard("{Enter}");
      } else {
        fireEvent.click(link);
      }
    }
    expect(await screen.findByRole("heading", { name: "Ticket Detail destination" })).toBeInTheDocument();
  });

  it("retains Previous/Next behavior and button presentation alongside cards", async () => {
    const fetchSpy = vi.spyOn(api, "fetchTickets").mockImplementation(async params => ({
      items: [cardTicket], page: params.page ?? 1, pageSize: 10,
      totalItems: 11, totalPages: 2, noResults: false,
    }));
    renderScreen();
    await screen.findByRole("list", { name: "My Tickets cards" });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    for (const name of ["Previous", "Next"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("btn", "btn-sm", "btn-outline-secondary");
    }
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Page 1 of 2");
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("shows the empty state when the Requester has zero tickets and no filters are set (BR-29)", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue({
      ...emptyResponse(),
      noResults: false,
    });

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText(/don't have any tickets yet/i)
      ).toBeInTheDocument();
    });
  });

  it("shows the no-results state when a search/filter matches nothing (BR-30)", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue(
      emptyResponse()
    );

    renderScreen();

    await waitFor(() =>
      screen.getByLabelText(/search tickets/i)
    );

    fireEvent.change(
      screen.getByLabelText(/search tickets/i),
      {
        target: {
          value: "nonexistent",
        },
      }
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /no tickets match your search/i
        )
      ).toBeInTheDocument();
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
      expect(
        within(screen.getByRole("table")).getByText("TKT-2026-000001")
      ).toBeInTheDocument();
    });

    expect(
      within(screen.getByRole("table")).getByText(
        "Laptop battery drains quickly"
      )
    ).toBeInTheDocument();
  });

  it("shows a safe error state on API failure", async () => {
    vi.spyOn(api, "fetchTickets").mockRejectedValue(
      new Error("failed")
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toBeInTheDocument();
    });
  });

  it("Clear Filters is disabled with no active filters, enabled once one is set", async () => {
    vi.spyOn(api, "fetchTickets").mockResolvedValue({
      ...emptyResponse(),
      noResults: false,
    });

    renderScreen();

    await waitFor(() =>
      screen.getByLabelText(/search tickets/i)
    );

    const clearButton =
      screen.getByRole("button", {
        name: /clear filters/i,
      });

    expect(clearButton).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText(/search tickets/i),
      {
        target: {
          value: "laptop",
        },
      }
    );

    await waitFor(() => {
      expect(clearButton).not.toBeDisabled();
    });
  });

  it("clicking Clear Filters resets search and re-fetches with no filters", async () => {
    const fetchSpy = vi
      .spyOn(api, "fetchTickets")
      .mockResolvedValue({
        ...emptyResponse(),
        noResults: false,
      });

    renderScreen();

    await waitFor(() =>
      screen.getByLabelText(/search tickets/i)
    );

    fireEvent.change(
      screen.getByLabelText(/search tickets/i),
      {
        target: {
          value: "laptop",
        },
      }
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "laptop",
        })
      );
    });

    // Two "Clear Filters" buttons can coexist once a filter is active: the
    // always-visible toolbar one, and the one inside the no-results state.
    // Either does the same thing — click the toolbar one (first in the DOM).
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /clear filters/i,
      })[0]
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(/search tickets/i)
      ).toHaveValue("");
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.not.objectContaining({
        search: expect.anything(),
      })
    );
  });

  it("renders a Created Date column alongside Last Updated", async () => {
    const createdAt = new Date(
      "2026-01-15T00:00:00Z"
    ).toISOString();

    const updatedAt = new Date(
      "2026-02-20T00:00:00Z"
    ).toISOString();

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

    await waitFor(() =>
      within(screen.getByRole("table")).getByText("TKT-2026-000001")
    );

    // The sortable column headers use role="button" (for clickability),
    // not the default columnheader role — scoped to the table since the
    // "Sort" dropdown button's label also contains "Created Date".
    const table = screen.getByRole("table");

    expect(
      within(table).getByRole("button", {
        name: /created date/i,
      })
    ).toBeInTheDocument();

    expect(
      within(table).getByText(
        new Date(createdAt).toLocaleDateString()
      )
    ).toBeInTheDocument();

    expect(
      within(table).getByText(
        new Date(updatedAt).toLocaleDateString()
      )
    ).toBeInTheDocument();
  });

  it("clicking the Created Date header sorts by createdAt", async () => {
    const fetchSpy = vi
      .spyOn(api, "fetchTickets")
      .mockResolvedValue({
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

    await waitFor(() =>
      within(screen.getByRole("table")).getByText("TKT-2026-000001")
    );

    // createdAt/desc is already the default sort state, so the FIRST click
    // on "Created Date" flips it to asc (same column, direction toggles) —
    // it does not re-select "desc", since that's already active.
    fireEvent.click(
      within(
        screen.getByRole("table")
      ).getByRole("button", {
        name: /created date/i,
      })
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "createdAt",
          sortDir: "asc",
        })
      );
    });

    // The table briefly unmounts (loading state) and remounts on every sort
    // change, so we must re-query it fresh here rather than reuse the
    // reference from before the first click.
    await waitFor(() =>
      within(screen.getByRole("table")).getByText("TKT-2026-000001")
    );

    fireEvent.click(
      within(
        screen.getByRole("table")
      ).getByRole("button", {
        name: /created date/i,
      })
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "createdAt",
          sortDir: "desc",
        })
      );
    });
  });

  it("Sort button opens a dropdown and selecting a field sorts by it", async () => {
    const fetchSpy = vi
      .spyOn(api, "fetchTickets")
      .mockResolvedValue({
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

    await waitFor(() =>
      within(screen.getByRole("table")).getByText("TKT-2026-000001")
    );

    // Default label reflects createdAt/desc before any interaction
    expect(
      screen.getByRole("button", {
        name: /sort: created date/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /sort: created date/i,
      })
    );

    fireEvent.click(
      screen.getByRole("menuitem", {
        name: /^ticket no\./i,
      })
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "ticketNumber",
        })
      );
    });

    expect(
      screen.getByRole("button", {
        name: /sort: ticket no\./i,
      })
    ).toBeInTheDocument();
  });
});
