import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequesterGuard from "../../src/components/RequesterGuard.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";

function renderAtTickets() {
  return render(
    <MemoryRouter initialEntries={["/tickets"]}>
      <RequesterProvider>
        <Routes>
          <Route path="/" element={<div>Requester Selection Screen</div>} />
          <Route
            path="/tickets"
            element={
              <RequesterGuard>
                <div>My Tickets</div>
              </RequesterGuard>
            }
          />
        </Routes>
      </RequesterProvider>
    </MemoryRouter>
  );
}

describe("RequesterGuard (AC-02, BR-07)", () => {
  it("redirects to Requester Selection when no requester is selected", () => {
    localStorage.clear();
    renderAtTickets();

    expect(screen.getByText("Requester Selection Screen")).toBeInTheDocument();
    expect(screen.queryByText("My Tickets")).not.toBeInTheDocument();
  });

  it("renders children once a requester has been selected", () => {
    localStorage.setItem(
      "toktickit.devRequester",
      JSON.stringify({ id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" })
    );

    renderAtTickets();

    expect(screen.getByText("My Tickets")).toBeInTheDocument();
  });
});
