import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";

function TestConsumer() {
  const { requester, selectRequester, changeRequester } = useRequester();
  return (
    <div>
      <span data-testid="current">{requester ? requester.name : "none"}</span>
      <button
        onClick={() =>
          selectRequester({ id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" })
        }
      >
        Select
      </button>
      <button onClick={changeRequester}>Change</button>
    </div>
  );
}

describe("RequesterContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with no requester selected", () => {
    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );
    expect(screen.getByTestId("current")).toHaveTextContent("none");
  });

  it("stores the selected requester and persists it to localStorage", () => {
    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );

    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByTestId("current")).toHaveTextContent("Jennifer Anderson");
    expect(localStorage.getItem("toktickit.devRequester")).toContain("Jennifer Anderson");
  });

  it("clears the requester on changeRequester, forcing re-selection (BR-06)", () => {
    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );

    fireEvent.click(screen.getByText("Select"));
    fireEvent.click(screen.getByText("Change"));

    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(localStorage.getItem("toktickit.devRequester")).toBeNull();
  });
});
