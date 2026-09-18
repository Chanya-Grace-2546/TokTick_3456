import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import * as api from "../../src/api.js";

vi.mock("../../src/context/AuthContext.js", () => ({
  useAuth: () => ({
    refreshUser: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../src/api.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/api.js")>(
    "../../src/api.js"
  );

  return {
    ...actual,
    fetchStaffTicketDetail: vi.fn(),
    fetchStaffOwners: vi.fn(),
    claimStaffTicket: vi.fn(),
    updateStaffTicketOwner: vi.fn(),
    updateStaffTicketPriority: vi.fn(),
    updateStaffTicketStatus: vi.fn(),
    createPublicComment: vi.fn(),
    createInternalNote: vi.fn(),
    downloadAttachment: vi.fn(),
  };
});

const ticket = {
  id: 42,
  ticketNumber: "TT-000042",
  summary: "Cannot access campus Wi-Fi",
  description: "Wi-Fi authentication fails on my laptop.",
  requestedPriority: "MEDIUM" as const,
  itPriority: "HIGH" as const,
  status: "OPEN" as const,
  requesterResolvedAt: "2026-09-17T10:00:00.000Z",
  requesterResolvedById: 7,
  createdAt: "2026-09-16T08:00:00.000Z",
  updatedAt: "2026-09-17T09:00:00.000Z",
  requester: {
    id: 7,
    name: "Requester Test",
    email: "requester@example.com",
  },
  category: {
    id: 1,
    name: "Network",
  },
  relatedSystem: {
    id: 2,
    name: "Campus Wi-Fi",
  },
  owner: null,
  attachments: [
    {
      id: 5,
      fileName: "error.png",
      sizeBytes: 2048,
      mimeType: "image/png",
      isRemoved: false,
      removedAt: null,
      removedReason: null,
      createdAt: "2026-09-16T08:10:00.000Z",
    },
  ],
  publicComments: [
    {
      id: 10,
      content: "Please try connecting again.",
      author: {
        id: 2,
        name: "IT Staff",
        role: "IT_STAFF" as const,
      },
      createdAt: "2026-09-16T09:00:00.000Z",
    },
  ],
  internalNotes: [
    {
      id: 11,
      content: "Authentication service checked.",
      author: {
        id: 2,
        name: "IT Staff",
        role: "IT_STAFF" as const,
      },
      createdAt: "2026-09-16T09:05:00.000Z",
    },
  ],
};

const owners = [
  {
    id: 2,
    name: "IT Staff",
    email: "staff@example.com",
    role: "IT_STAFF" as const,
  },
  {
    id: 3,
    name: "Administrator",
    email: "admin@example.com",
    role: "ADMINISTRATOR" as const,
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/staff/tickets/42"]}>
      <Routes>
        <Route
          path="/staff/tickets/:id"
          element={<StaffTicketDetail />}
        />
        <Route
          path="/staff/tickets"
          element={<div>Queue page</div>}
        />
        <Route
          path="/login"
          element={<div>Login page</div>}
        />
        <Route
          path="/change-password"
          element={<div>Change password page</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("Lab 3 Issue 6 — Staff Ticket Detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(ticket);
    vi.mocked(api.fetchStaffOwners).mockResolvedValue(owners);
    vi.mocked(api.claimStaffTicket).mockResolvedValue({
      id: ticket.id,
      owner: owners[0],
    });
    vi.mocked(api.updateStaffTicketOwner).mockResolvedValue({
      id: ticket.id,
      owner: owners[1],
    });
    vi.mocked(api.updateStaffTicketPriority).mockResolvedValue({
      id: ticket.id,
      requestedPriority: ticket.requestedPriority,
      itPriority: "LOW",
    });
    vi.mocked(api.updateStaffTicketStatus).mockResolvedValue({
      id: ticket.id,
      status: "IN_PROGRESS",
      ownerId: null,
    });
    vi.mocked(api.createPublicComment).mockResolvedValue({
      id: 12,
      content: "Public update",
      author: owners[0],
      createdAt: "2026-09-17T11:00:00.000Z",
    });
    vi.mocked(api.createInternalNote).mockResolvedValue({
      id: 13,
      content: "Private update",
      author: owners[0],
      createdAt: "2026-09-17T11:01:00.000Z",
    });
  });

  it("UI07 renders staff operational detail and keeps requested priority read-only", async () => {
    renderPage();

    expect(await screen.findByText("TT-000042")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Request Details" })).toBeInTheDocument();
    expect(screen.getByText("Requester Test")).toBeInTheDocument();
    expect(screen.getByText("requester@example.com")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Campus Wi-Fi")).toBeInTheDocument();
    expect(screen.getByText("Cannot access campus Wi-Fi")).toBeInTheDocument();

    expect(screen.getByText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByLabelText("Requested Priority")).not.toBeInTheDocument();

    expect(
      screen.getByText(/Requester reports the problem appears resolved/i)
    ).toBeInTheDocument();

    expect(screen.getByText("error.png")).toBeInTheDocument();
  });

  it("UI07 shows Claim for an unassigned ticket and calls the claim endpoint", async () => {
    renderPage();

    const claim = await screen.findByRole("button", { name: "Claim Ticket" });
    fireEvent.click(claim);

    await waitFor(() => {
      expect(api.claimStaffTicket).toHaveBeenCalledWith(42);
    });

    expect(
      await screen.findByText("Ticket claimed successfully.")
    ).toBeInTheDocument();
  });

  it("UI07 assigns or reassigns only through the owner selector", async () => {
    renderPage();

    const owner = await screen.findByLabelText("Ticket Owner");
    fireEvent.change(owner, {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(api.updateStaffTicketOwner).toHaveBeenCalledWith(42, 3);
    });
  });

  it("UI07 updates IT Priority independently from Requested Priority", async () => {
    renderPage();

    const priority = await screen.findByLabelText("IT Priority");
    fireEvent.change(priority, {
      target: { value: "LOW" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save IT Priority" })
    );

    await waitFor(() => {
      expect(api.updateStaffTicketPriority).toHaveBeenCalledWith(42, "LOW");
    });

    expect(api.updateStaffTicketPriority).not.toHaveBeenCalledWith(
      42,
      ticket.requestedPriority
    );
  });

  it("UI07 offers only permitted next statuses for the current status", async () => {
    renderPage();

    const status = await screen.findByLabelText("Status");
    const values = Array.from(
      (status as HTMLSelectElement).options
    ).map(option => option.value);

    expect(values).toEqual([
      "",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ]);

    expect(values).not.toContain("NEW");
    expect(values).not.toContain("OPEN");
    expect(values).not.toContain("CLOSED");
    expect(values).not.toContain("REOPENED");
  });

  it("UI07 confirms Resolved, Closed, and Cancelled style completion transitions before saving", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);

    renderPage();

    const status = await screen.findByLabelText("Status");
    fireEvent.change(status, {
      target: { value: "RESOLVED" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Change Status" })
    );

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(api.updateStaffTicketStatus).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("UI07 changes a permitted non-confirmation status directly", async () => {
    renderPage();

    const status = await screen.findByLabelText("Status");
    fireEvent.change(status, {
      target: { value: "IN_PROGRESS" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Change Status" })
    );

    await waitFor(() => {
      expect(api.updateStaffTicketStatus).toHaveBeenCalledWith(
        42,
        "IN_PROGRESS"
      );
    });
  });

  it("UI07 clearly separates Public Comments from private Internal Notes", async () => {
    renderPage();

    await screen.findByText("TT-000042");

    expect(
      screen.getByRole("heading", { name: "Public Comments" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Visible to Requester").length).toBeGreaterThan(0);
    expect(screen.getByText("Please try connecting again.")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Internal Notes" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Internal — not visible to Requester/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Authentication service checked.")).toBeInTheDocument();
  });

  it("UI07 posts a Public Comment and an Internal Note through separate actions", async () => {
    renderPage();

    await screen.findByText("TT-000042");

    fireEvent.change(screen.getByLabelText("Add Public Comment"), {
      target: { value: "Public update" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Post Public Comment" })
    );

    await waitFor(() => {
      expect(api.createPublicComment).toHaveBeenCalledWith(
        42,
        "Public update"
      );
    });

    fireEvent.change(screen.getByLabelText("Add Internal Note"), {
      target: { value: "Private update" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add Internal Note" })
    );

    await waitFor(() => {
      expect(api.createInternalNote).toHaveBeenCalledWith(
        42,
        "Private update"
      );
    });
  });

  it("UI07 rejects whitespace-only communication before calling the API", async () => {
    renderPage();

    await screen.findByText("TT-000042");

    const publicBox = screen.getByLabelText("Add Public Comment");
    fireEvent.change(publicBox, {
      target: { value: "   " },
    });

    expect(
      screen.getByRole("button", { name: "Post Public Comment" })
    ).toBeDisabled();

    const internalBox = screen.getByLabelText("Add Internal Note");
    fireEvent.change(internalBox, {
      target: { value: "   " },
    });

    expect(
      screen.getByRole("button", { name: "Add Internal Note" })
    ).toBeDisabled();

    expect(api.createPublicComment).not.toHaveBeenCalled();
    expect(api.createInternalNote).not.toHaveBeenCalled();
  });
});
