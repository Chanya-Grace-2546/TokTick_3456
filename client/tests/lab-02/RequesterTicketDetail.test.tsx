import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
} from "react-router-dom";
import TicketDetail from "../../src/pages/TicketDetail.js";
import * as api from "../../src/api.js";

function renderScreen(id = "1") {
  return render(
    <MemoryRouter
      initialEntries={[`/tickets/${id}`]}
    >
      <Routes>
        <Route
          path="/tickets/:id"
          element={<TicketDetail />}
        />
      </Routes>
    </MemoryRouter>
  );
}

function baseTicket(
  overrides: Partial<api.TicketDetailData> = {}
): api.TicketDetailData {
  return {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    requesterId: 1,
    category: "Hardware",
    relatedSystem: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description:
      "Battery drains fast even when idle, started after last update.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "NEW",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    ...overrides,
  };
}

describe("TicketDetail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state, then the ticket's read-only fields", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(baseTicket());

    renderScreen();

    expect(
      screen.getByRole("status")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("TKT-2026-000001")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Hardware")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Corporate Laptop")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Laptop battery drains quickly"
      )
    ).toBeInTheDocument();
  });

  it("loads the ticket without sending requesterId from the client", async () => {
    const fetchSpy = vi
      .spyOn(api, "fetchTicketDetail")
      .mockResolvedValue(baseTicket());

    renderScreen("7");

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(7);
    });
  });

  it("shows a not-found message for a ticket that isn't the authenticated Requester's own", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockRejectedValue(
      new api.TicketNotFoundError(
        "TICKET_NOT_FOUND"
      )
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        /doesn't exist or isn't available/i
      );
    });
  });

  it("lists active and removed attachments differently", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(
      baseTicket({
        attachments: [
          {
            id: 1,
            fileName: "screenshot.png",
            sizeBytes: 12345,
            isRemoved: false,
            removedAt: null,
            removedReason: null,
            createdAt:
              new Date().toISOString(),
          },
          {
            id: 2,
            fileName: "old-log.pdf",
            sizeBytes: 5000,
            isRemoved: true,
            removedAt:
              new Date().toISOString(),
            removedReason: "Wrong file",
            createdAt:
              new Date().toISOString(),
          },
        ],
      })
    );

    renderScreen();

    await waitFor(() =>
      screen.getByText(/screenshot.png/)
    );

    expect(
      screen.getByText(/old-log.pdf/)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Wrong file/)
    ).toBeInTheDocument();

    // Only the active attachment gets Download and Remove actions.
    expect(
      screen.getAllByRole("button", {
        name: /download/i,
      })
    ).toHaveLength(1);
  });

  it("shows an upload error message returned by the API", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(baseTicket());

    vi.spyOn(
      api,
      "uploadAttachment"
    ).mockRejectedValue(
      new api.AttachmentUploadError(
        "MAX_ATTACHMENTS_REACHED"
      )
    );

    renderScreen();

    await waitFor(() =>
      screen.getByLabelText(
        /add attachment/i,
        {
          selector: "input",
        }
      )
    );

    const file = new File(
      ["x"],
      "photo.png",
      {
        type: "image/png",
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        /add attachment/i,
        {
          selector: "input",
        }
      ),
      {
        target: {
          files: [file],
        },
      }
    );

    await waitFor(() => {
      expect(
  screen.getByRole("alert")
).toHaveTextContent(
  /maximum of 5 active attachments reached/i
);
    });
  });

  it("uploads an attachment without sending requesterId", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(baseTicket());

    const uploadSpy = vi
      .spyOn(api, "uploadAttachment")
      .mockResolvedValue({
        id: 1,
        fileName: "photo.png",
        sizeBytes: 100,
        isRemoved: false,
        removedAt: null,
        removedReason: null,
        createdAt: new Date().toISOString(),
      });

    renderScreen();

    await waitFor(() =>
      screen.getByLabelText(
        /add attachment/i,
        {
          selector: "input",
        }
      )
    );

    const file = new File(
      ["x"],
      "photo.png",
      {
        type: "image/png",
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        /add attachment/i,
        {
          selector: "input",
        }
      ),
      {
        target: {
          files: [file],
        },
      }
    );

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(
        1,
        file
      );
    });
  });

  it("removes an attachment after confirming a reason via prompt", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(
      baseTicket({
        attachments: [
          {
            id: 1,
            fileName: "screenshot.png",
            sizeBytes: 12345,
            isRemoved: false,
            removedAt: null,
            removedReason: null,
            createdAt:
              new Date().toISOString(),
          },
        ],
      })
    );

    const removeSpy = vi
      .spyOn(api, "removeAttachment")
      .mockResolvedValue({
        id: 1,
        fileName: "screenshot.png",
        sizeBytes: 12345,
        isRemoved: true,
        removedAt:
          new Date().toISOString(),
        removedReason: "No longer needed",
        createdAt:
          new Date().toISOString(),
      });

    vi.spyOn(
      window,
      "prompt"
    ).mockReturnValue(
      "No longer needed"
    );

    renderScreen();

    await waitFor(() =>
      screen.getByRole("button", {
        name: /remove/i,
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /remove/i,
      })
    );

    await waitFor(() => {
      expect(
        removeSpy
      ).toHaveBeenCalledWith(
        1,
        "No longer needed"
      );
    });
  });
});