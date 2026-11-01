import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionTakenForm from "../../src/components/ActionTakenForm.js";
import { action, owners, staff } from "./helpers/actionFixture.js";
describe("Actions accessibility (AC-16/28)", () => {
  it("focuses the form heading and provides visible labels and keyboard controls", async () => {
    const cancel = vi.fn();
    render(<ActionTakenForm ticketId={42} owners={owners} performer={staff.name} onCancel={cancel} onSuccess={vi.fn()} onFailure={vi.fn()} onReload={vi.fn()} refreshOwners={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "New Action" })).toHaveFocus();
    const user = userEvent.setup(); await user.tab();
    expect(screen.getByLabelText(/Action Date\/Time/)).toHaveFocus();
    for (const label of ["Description (required)", "Result", "Assigned To", "Follow-Up Required", "Follow-Up Note", "Attachment Notes", "State"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    screen.getByRole("button", { name: "Cancel" }).focus(); await user.keyboard("{Enter}"); expect(cancel).toHaveBeenCalledOnce();
  });
  it("associates semantic errors with fields and announces validation feedback", () => {
    render(<ActionTakenForm ticketId={42} action={{ ...action, description: "" }} owners={owners} performer={staff.name} onCancel={vi.fn()} onSuccess={vi.fn()} onFailure={vi.fn()} onReload={vi.fn()} refreshOwners={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    const description = screen.getByLabelText("Description (required)");
    expect(description).toHaveAttribute("aria-invalid", "true"); expect(description).toHaveAccessibleDescription(expect.stringContaining("Description is required."));
    expect(screen.getByRole("alert")).toHaveTextContent("Review the highlighted fields");
  });
  it("announces the existing Result limit without inventing limits on other text fields", () => {
    render(<ActionTakenForm ticketId={42} owners={owners} performer={staff.name} onCancel={vi.fn()} onSuccess={vi.fn()} onFailure={vi.fn()} onReload={vi.fn()} refreshOwners={vi.fn()} />);
    const result = screen.getByLabelText("Result");
    expect(result).toHaveAttribute("maxlength", "2000");
    expect(result).toHaveAccessibleDescription(expect.stringContaining("0 / 2000 characters"));
    fireEvent.change(result, { target: { value: "Done" } });
    expect(result).toHaveAccessibleDescription(expect.stringContaining("4 / 2000 characters"));
    for (const label of ["Description (required)", "Follow-Up Note", "Attachment Notes"]) expect(screen.getByLabelText(label)).not.toHaveAttribute("maxlength");
    expect(screen.getByText(/No minimum word count/)).toBeInTheDocument();
  });

});
