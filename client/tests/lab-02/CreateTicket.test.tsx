import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CreateTicket from "../../src/pages/CreateTicket.js";
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
        <CreateTicket />
      </RequesterProvider>
    </MemoryRouter>
  );
}

function mockReferenceData() {
  vi.spyOn(api, "fetchCategories").mockResolvedValue([
    { id: 1, name: "Hardware" },
    { id: 2, name: "Software" },
  ]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([
    { id: 1, name: "Corporate Laptop" },
    { id: 2, name: "Email" },
  ]);
}

async function fillValidForm() {
  await waitFor(() => screen.getByLabelText(/category/i));
  fireEvent.change(screen.getByLabelText(/^category/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/related system/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/requested priority/i), { target: { value: "MEDIUM" } });
  fireEvent.change(screen.getByLabelText(/summary/i), {
    target: { value: "Laptop battery drains quickly" },
  });
  fireEvent.change(screen.getByLabelText(/description/i), {
    target: { value: "Battery drains fast even when idle, started after last update." },
  });
}

describe("CreateTicket", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows the generated Ticket Number on success (AC-01)", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000101",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Laptop battery drains quickly",
      description: "Battery drains fast even when idle, started after last update.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      status: "NEW",
      createdAt: new Date().toISOString(),
    });

    renderScreen();
    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => {
      expect(screen.getByText("TKT-2026-000101")).toBeInTheDocument();
    });
  });

  it("shows a field-level message and keeps entered values on validation failure (AC-04, BR-19)", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockRejectedValue(
      new api.CreateTicketValidationError({ summary: "Summary must be between 5 and 120 characters" })
    );

    renderScreen();
    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Summary must be between 5 and 120 characters")
      ).toBeInTheDocument();
    });
    // BR-19: entered values remain on screen after failure
    expect(screen.getByLabelText(/summary/i)).toHaveValue("Laptop battery drains quickly");
  });

  it("shows a safe error state and keeps values on network failure (AC-14, BR-20)", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("Network error"));

    renderScreen();
    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "Battery drains fast even when idle, started after last update."
    );
  });

  it("disables Submit while the request is in flight", async () => {
    mockReferenceData();
    let resolveCreate: (value: api.Ticket) => void = () => {};
    vi.spyOn(api, "createTicket").mockReturnValue(
      new Promise<api.Ticket>((resolve) => {
        resolveCreate = resolve;
      })
    );

    renderScreen();
    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();

    resolveCreate({
      id: 1,
      ticketNumber: "TKT-2026-000102",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "x",
      description: "y",
      requestedPriority: "MEDIUM",
      itPriority: null,
      status: "NEW",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(screen.getByText("TKT-2026-000102")).toBeInTheDocument();
    });
  });

  it("rejects a disallowed file type client-side before submitting", async () => {
    mockReferenceData();
    renderScreen();
    await fillValidForm();

    const badFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [badFile] } });

    expect(
      screen.getByText(/isn't an allowed type \(JPG, PNG, WEBP, or PDF only\)/i)
    ).toBeInTheDocument();
  });

  it("uploads selected files after the Ticket is created", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockResolvedValue({
      id: 42,
      ticketNumber: "TKT-2026-000103",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Laptop battery drains quickly",
      description: "Battery drains fast even when idle, started after last update.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      status: "NEW",
      createdAt: new Date().toISOString(),
    });
    const uploadSpy = vi.spyOn(api, "uploadAttachment").mockResolvedValue({
      id: 1,
      fileName: "photo.png",
      sizeBytes: 100,
      isRemoved: false,
      removedAt: null,
      removedReason: null,
      createdAt: new Date().toISOString(),
    });

    renderScreen();
    await fillValidForm();

    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(42, 1, file);
    });
    expect(screen.getByText("TKT-2026-000103")).toBeInTheDocument();
  });

  it("reports attachment failures but still shows the Ticket as saved (BR-21)", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockResolvedValue({
      id: 42,
      ticketNumber: "TKT-2026-000104",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Laptop battery drains quickly",
      description: "Battery drains fast even when idle, started after last update.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      status: "NEW",
      createdAt: new Date().toISOString(),
    });
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(
      new api.AttachmentUploadError("INVALID_FILE_TYPE")
    );

    renderScreen();
    await fillValidForm();

    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => {
      expect(screen.getByText("TKT-2026-000104")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 attachment\(s\) failed to upload/i)).toBeInTheDocument();
  });
});
