import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActionsTaken from "../../src/components/ActionsTaken.js";
import FollowUpResolutionForm from "../../src/components/FollowUpResolutionForm.js";
import * as api from "../../src/api.js";
import { action, owners, page, staff } from "./helpers/actionFixture.js";
const auth = vi.hoisted(() => ({ role: "IT_STAFF" }));
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ user: { ...staff, role: auth.role }, refreshUser: vi.fn() }) }));
vi.mock("../../src/api.js", async original => ({ ...await original<typeof import("../../src/api.js")>(), fetchActions: vi.fn(), recordFollowUpResolution: vi.fn(), fetchStaffOwners: vi.fn() }));
const completed: api.ActionTaken = { ...action, state: "COMPLETED", followUpRequired: true };
beforeEach(() => { vi.clearAllMocks(); auth.role = "IT_STAFF"; vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [completed] }); });
it.each(["RESOLVED", "CLOSED", "CANCELLED"])("shows %s Ticket Actions read-only", async ticketStatus => {
  render(<MemoryRouter><ActionsTaken ticketId={42} canWrite owners={owners} ticketStatus={ticketStatus} /></MemoryRouter>);
  await screen.findByText("Checked router"); expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Record Follow-Up Outcome" })).not.toBeInTheDocument();
});
it("offers an append-only outcome form without allowing completed Action edits", async () => {
  render(<MemoryRouter><ActionsTaken ticketId={42} canWrite owners={owners} ticketStatus="OPEN" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Record Follow-Up Outcome" }));
  expect(screen.getByRole("heading", { name: "Record Follow-Up Outcome for Action #31" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Edit Action 31" })).not.toBeInTheDocument();
});
it("renders recorded outcomes read-only to Requesters without fetching staff", async () => {
  auth.role = "REQUESTER";
  vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [{ ...completed, followUpResolution: { outcome: "Service confirmed", actor: { id: 2, name: "Staff" }, occurredAt: action.updatedAt } }] });
  render(<MemoryRouter><ActionsTaken ticketId={42} ticketStatus="RESOLVED" /></MemoryRouter>);
  await screen.findByText("Service confirmed"); expect(screen.getByText("Satisfied")).toBeInTheDocument(); expect(api.fetchStaffOwners).not.toHaveBeenCalled();
});
it("retains the original outcome and version for an ambiguous retry", async () => {
  vi.mocked(api.recordFollowUpResolution).mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce({ followUpResolution: { outcome: "Verified", actor: { id: 2, name: "Staff" }, occurredAt: action.updatedAt } });
  const success = vi.fn(); render(<FollowUpResolutionForm action={completed} readOnly={false} onSuccess={success} onFailure={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Follow-Up Outcome (required)"), { target: { value: "Verified" } }); fireEvent.click(screen.getByRole("button", { name: "Record Outcome" }));
  await screen.findByText("Retry uses the original outcome and version."); expect(screen.getByLabelText("Follow-Up Outcome (required)")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Record Outcome" })); await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(vi.mocked(api.recordFollowUpResolution).mock.calls).toEqual([[42,31,{ version: action.version, outcome: "Verified" }],[42,31,{ version: action.version, outcome: "Verified" }]]);
});
it("retains an edit draft when a status refresh makes the Ticket read-only", async () => {
  vi.mocked(api.fetchActions).mockResolvedValue(page);
  const tree = (ticketStatus: string, refreshKey = 0) => <MemoryRouter><ActionsTaken ticketId={42} canWrite owners={owners} ticketStatus={ticketStatus} refreshKey={refreshKey} /></MemoryRouter>;
  const view = render(tree("OPEN")); fireEvent.click(await screen.findByRole("button", { name: "Edit Action 31" }));
  const description = screen.getByLabelText(/Description/); fireEvent.change(description, { target: { value: "Preserved draft" } });
  view.rerender(tree("CANCELLED", 1)); await waitFor(() => expect(api.fetchActions).toHaveBeenCalledTimes(2));
  expect(description).toHaveValue("Preserved draft"); expect(description).toBeDisabled();
});

it.each([false,true])("reloads another staff member's outcome while preserving the draft (ambiguous=%s)", async ambiguous => {
  vi.mocked(api.recordFollowUpResolution).mockRejectedValueOnce(ambiguous ? new TypeError("network") : new api.ActionRequestError(409, "FOLLOW_UP_ALREADY_SATISFIED", {}));
  const authoritative = { ...completed, followUpResolution: { outcome: "Confirmed by colleague", actor: { id: 8, name: "Priya Staff" }, occurredAt: action.updatedAt } };
  render(<MemoryRouter><ActionsTaken ticketId={42} canWrite owners={owners} ticketStatus="OPEN" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Record Follow-Up Outcome" }));
  fireEvent.change(screen.getByLabelText("Follow-Up Outcome (required)"), { target: { value: "My retained outcome" } });
  fireEvent.click(screen.getByRole("button", { name: "Record Outcome" }));
  await screen.findByRole("alert");
  vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [authoritative] });
  fireEvent.click(screen.getByRole("button", { name: "Reload and Review Follow-Up" }));
  await screen.findByRole("region", { name: "Recorded follow-up outcome" });
  expect(screen.getByLabelText("Follow-Up Outcome (required)")).toHaveValue("My retained outcome");
  expect(screen.getByRole("button", { name: "Record Outcome" })).toBeDisabled();
  expect(api.recordFollowUpResolution).toHaveBeenCalledTimes(1);
  expect(api.fetchActions).toHaveBeenCalledTimes(2);
});
it("keeps an ambiguous original request frozen when reload finds no satisfaction event", async () => {
  vi.mocked(api.recordFollowUpResolution).mockRejectedValueOnce(new TypeError("network"));
  const reload = vi.fn().mockResolvedValue(completed);
  render(<FollowUpResolutionForm action={completed} readOnly={false} onSuccess={vi.fn()} onFailure={vi.fn()} onCancel={vi.fn()} onReload={reload} />);
  fireEvent.change(screen.getByLabelText("Follow-Up Outcome (required)"), { target: { value: "Original outcome" } });
  fireEvent.click(screen.getByRole("button", { name: "Record Outcome" })); await screen.findByText("Retry uses the original outcome and version.");
  fireEvent.click(screen.getByRole("button", { name: "Reload and Review Follow-Up" }));
  await screen.findByText("No recorded outcome was found. Your draft and original request identity are retained.");
  expect(screen.getByLabelText("Follow-Up Outcome (required)")).toBeDisabled(); expect(api.recordFollowUpResolution).toHaveBeenCalledTimes(1);
});
