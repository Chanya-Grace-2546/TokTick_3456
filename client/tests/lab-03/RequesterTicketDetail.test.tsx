import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
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
    currentStatus: "WAITING_FOR_REQUESTER",
    requesterResolvedAt: null,
    requesterResolvedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    ...overrides,
  };
}

const existingComments: api.PublicComment[] = [
  {
    id: 10,
    content: "Please restart the laptop and test again.",
    author: {
      id: 103,
      name: "Alex Morgan",
      role: "IT_STAFF",
    },
    createdAt: "2026-09-17T10:00:00.000Z",
  },
];

describe("Lab 3 Requester Ticket Detail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(baseTicket());

    vi.spyOn(
      api,
      "fetchPublicComments"
    ).mockResolvedValue({
      items: existingComments,
    });
  });

  it("shows Public Comments with author information", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Please restart the laptop and test again."
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Alex Morgan/)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/IT Staff/i)
    ).toBeInTheDocument();
  });

  it("loads Public Comments for the current Ticket without requesterId", async () => {
    const commentsSpy =
      vi.spyOn(
        api,
        "fetchPublicComments"
      ).mockResolvedValue({
        items: [],
      });

    renderScreen("7");

    await waitFor(() => {
      expect(
        commentsSpy
      ).toHaveBeenCalledWith(7);
    });
  });

  it("allows the Requester to post a Public Comment", async () => {
    const createSpy =
      vi.spyOn(
        api,
        "createPublicComment"
      ).mockResolvedValue({
        id: 11,
        content:
          "The issue is still happening.",
        author: {
          id: 1,
          name: "Jennifer Anderson",
          role: "REQUESTER",
        },
        createdAt:
          "2026-09-17T11:00:00.000Z",
      });

    renderScreen();

    const input =
      await screen.findByLabelText(
        /public comment/i
      );

    fireEvent.change(input, {
      target: {
        value:
          "The issue is still happening.",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /post comment/i,
      })
    );

    await waitFor(() => {
      expect(
        createSpy
      ).toHaveBeenCalledWith(
        1,
        "The issue is still happening."
      );
    });

    expect(
      await screen.findByText(
        "The issue is still happening."
      )
    ).toBeInTheDocument();
  });

  it("does not submit a whitespace-only Public Comment", async () => {
    const createSpy =
      vi.spyOn(
        api,
        "createPublicComment"
      );

    renderScreen();

    const input =
      await screen.findByLabelText(
        /public comment/i
      );

    fireEvent.change(input, {
      target: {
        value: "     ",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /post comment/i,
      })
    );

    expect(
      createSpy
    ).not.toHaveBeenCalled();

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      /comment is required/i
    );
  });

  it("does not submit a Public Comment longer than 2000 characters", async () => {
    const createSpy =
      vi.spyOn(
        api,
        "createPublicComment"
      );

    renderScreen();

    const input =
      await screen.findByLabelText(
        /public comment/i
      );

    fireEvent.change(input, {
      target: {
        value: "a".repeat(2001),
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /post comment/i,
      })
    );

    expect(
      createSpy
    ).not.toHaveBeenCalled();

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      /2000 characters or fewer/i
    );
  });

  it("shows a safe failure message when posting a Public Comment fails", async () => {
    vi.spyOn(
      api,
      "createPublicComment"
    ).mockRejectedValue(
      new Error("network")
    );

    renderScreen();

    const input =
      await screen.findByLabelText(
        /public comment/i
      );

    fireEvent.change(input, {
      target: {
        value:
          "Still not working",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /post comment/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        /could not post/i
      );
    });
  });

  it("allows the Requester to indicate that the problem appears resolved", async () => {
    const timestamp =
      "2026-09-17T12:00:00.000Z";

    const resolveSpy =
      vi.spyOn(
        api,
        "markProblemAppearsResolved"
      ).mockResolvedValue({
        requesterResolvedAt:
          timestamp,
        status:
          "WAITING_FOR_REQUESTER",
      });

    renderScreen();

    const button =
      await screen.findByRole(
        "button",
        {
          name:
            /problem appears resolved/i,
        }
      );

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        resolveSpy
      ).toHaveBeenCalledWith(1);
    });

    expect(
      await screen.findByText(
        /you indicated that this problem appears resolved/i
      )
    ).toBeInTheDocument();
  });

  it("does not change the displayed formal Ticket status after apparent resolution", async () => {
    vi.spyOn(
      api,
      "markProblemAppearsResolved"
    ).mockResolvedValue({
      requesterResolvedAt:
        "2026-09-17T12:00:00.000Z",
      status:
        "WAITING_FOR_REQUESTER",
    });

    renderScreen();

    const button =
      await screen.findByRole(
        "button",
        {
          name:
            /problem appears resolved/i,
        }
      );

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(
          /you indicated that this problem appears resolved/i
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /waiting for requester/i
      )
    ).toBeInTheDocument();
  });

  it("shows an existing apparent-resolution indication", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(
      baseTicket({
        requesterResolvedAt:
          "2026-09-17T12:00:00.000Z",
        requesterResolvedById: 1,
      })
    );

    renderScreen();

    expect(
      await screen.findByText(
        /you indicated that this problem appears resolved/i
      )
    ).toBeInTheDocument();
  });

  it("clears the apparent-resolution indication in the UI after the Requester posts a new Public Comment", async () => {
    vi.spyOn(
      api,
      "fetchTicketDetail"
    ).mockResolvedValue(
      baseTicket({
        requesterResolvedAt:
          "2026-09-17T12:00:00.000Z",
        requesterResolvedById: 1,
      })
    );

    vi.spyOn(
      api,
      "createPublicComment"
    ).mockResolvedValue({
      id: 12,
      content:
        "The problem started again.",
      author: {
        id: 1,
        name: "Jennifer Anderson",
        role: "REQUESTER",
      },
      createdAt:
        "2026-09-17T13:00:00.000Z",
    });

    renderScreen();

    expect(
      await screen.findByText(
        /you indicated that this problem appears resolved/i
      )
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(
        /public comment/i
      ),
      {
        target: {
          value:
            "The problem started again.",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /post comment/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByText(
          /you indicated that this problem appears resolved/i
        )
      ).not.toBeInTheDocument();
    });
  });

  it("does not show an Internal Notes section to the Requester", async () => {
    renderScreen();

    await screen.findByText(
      "TKT-2026-000001"
    );

    expect(
      screen.queryByText(
        /internal notes/i
      )
    ).not.toBeInTheDocument();
  });
});