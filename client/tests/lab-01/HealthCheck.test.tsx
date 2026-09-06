import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HealthCheck from "../../src/pages/HealthCheck.js";
import * as api from "../../src/api.js";

describe("HealthCheck", () => {
  it("renders the TokTickIT heading", () => {
    render(<HealthCheck />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(<HealthCheck />);
    fireEvent.click(screen.getByText("Check System"));

    await waitFor(() => {
      expect(screen.getByText(/Online/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Hardware")).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("Backend health check failed"));

    render(<HealthCheck />);
    fireEvent.click(screen.getByText("Check System"));

    await waitFor(() => {
      expect(screen.getByText(/Offline/i)).toBeInTheDocument();
    });
  });
});