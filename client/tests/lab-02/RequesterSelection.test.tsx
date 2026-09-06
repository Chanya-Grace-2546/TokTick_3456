import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequesterSelection from "../../src/pages/RequesterSelection.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";

function renderScreen() {
  return render(
    <MemoryRouter>
      <RequesterProvider>
        <RequesterSelection />
      </RequesterProvider>
    </MemoryRouter>
  );
}

describe("RequesterSelection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows a loading state while fetching", () => {
    vi.spyOn(api, "fetchActiveRequesters").mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("lists the active requesters returned by the API (AC-13)", async () => {
    vi.spyOn(api, "fetchActiveRequesters").mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" },
      { id: 2, name: "Michael Brown", email: "michael@example.com" },
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    });
    expect(screen.getByText("Michael Brown")).toBeInTheDocument();
  });

  it("shows an empty state when there are zero active requesters", async () => {
    vi.spyOn(api, "fetchActiveRequesters").mockResolvedValue([]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/no active development requesters/i)).toBeInTheDocument();
    });
  });

  it("shows a safe error state on API failure (AC-14)", async () => {
    vi.spyOn(api, "fetchActiveRequesters").mockRejectedValue(new Error("failed"));
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("disables Continue until a requester is chosen", async () => {
    vi.spyOn(api, "fetchActiveRequesters").mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" },
    ]);

    renderScreen();
    await waitFor(() => screen.getByText("Jennifer Anderson"));

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/development requester/i), {
      target: { value: "1" },
    });

    expect(continueBtn).not.toBeDisabled();
  });
});
