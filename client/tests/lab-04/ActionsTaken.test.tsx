import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ActionsTaken from "../../src/components/ActionsTaken.js";
import ActionTakenForm from "../../src/components/ActionTakenForm.js";
import * as api from "../../src/api.js";
import { action, owners, page, staff } from "./helpers/actionFixture.js";
const auth = vi.hoisted(() => ({ role: "IT_STAFF", refreshUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ user: { ...staff, role: auth.role }, refreshUser: auth.refreshUser }) }));
vi.mock("../../src/api.js", async original => ({ ...await original<typeof import("../../src/api.js")>(), fetchActions: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(), fetchStaffOwners: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks(); auth.role = "IT_STAFF";
  vi.mocked(api.fetchActions).mockResolvedValue(page);
  vi.mocked(api.createAction).mockResolvedValue({ action }); vi.mocked(api.updateAction).mockResolvedValue({ action });
});
function section(props = {}) { return render(<MemoryRouter><ActionsTaken ticketId={42} canWrite owners={owners} {...props} /></MemoryRouter>); }
function form(actionValue: api.ActionTaken | null = action, reload = vi.fn().mockResolvedValue({ ...action, version: 3 })) {
  const success = vi.fn(), failure = vi.fn(), refreshOwners = vi.fn();
  render(<ActionTakenForm ticketId={42} action={actionValue ?? undefined} owners={owners} performer={staff.name} onCancel={vi.fn()} onSuccess={success} onFailure={failure} onReload={reload} refreshOwners={refreshOwners} />);
  return { success, failure, refreshOwners };
}
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
describe("Actions Taken list and permissions (AC-05/16/19/20/42)", () => {
  it("shows useful Action information without technical detail fields", async () => {
    section(); await screen.findByText("Checked router");
    for (const text of ["Working", "Priya Staff", "Check tomorrow", "See Ticket photo", "Planned"]) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Actions Taken, oldest first" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Action #31" })).toBeInTheDocument();
    for (const label of ["ID", "Ticket", "Version", "Performer ID", "Assignee ID"]) expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument(); expect(screen.getByText("Last updated")).toBeInTheDocument(); expect(screen.getAllByText("Alex Staff")).not.toHaveLength(0);
  });
  it("uses readable multiline cards with compact controls and expandable secondary details", async () => {
    vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [{ ...action, description: "Checked router\nRestored service" }] });
    section(); await screen.findByRole("article", { name: "Action #31" });
    const card = screen.getByRole("article", { name: "Action #31" });
    expect(card.querySelector(".action-description")?.textContent).toBe("Checked router\nRestored service");
    expect(screen.getByRole("button", { name: "Edit Action 31" })).toHaveClass("btn-sm");
    expect(screen.getByRole("button", { name: "Add Action" })).toHaveClass("btn-sm", "actions-add");
    const toggle = screen.getByRole("button", { name: "View Details for Action 31" });
    expect(toggle).toHaveAttribute("aria-expanded", "false"); fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Action 31 details" })).toBeVisible(); expect(screen.getByText("Attachment Notes")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Action pages" })).toBeInTheDocument();
  });
  it("omits empty optional notes while retaining meaningful follow-up notes", async () => {
    vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [{ ...action, followUpRequired: false, followUpNote: null, attachmentNotes: null }] });
    section(); await screen.findByRole("article", { name: "Action #31" });
    expect(screen.getByText("Not required")).toBeInTheDocument();
    expect(screen.queryByText("No follow-up note")).not.toBeInTheDocument();
    expect(screen.queryByText("Attachment Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("No attachment notes")).not.toBeInTheDocument();
  });
  it("retains a follow-up note after the flag is cleared", async () => {
    vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [{ ...action, followUpRequired: false }] });
    section(); await screen.findByText("Check tomorrow"); expect(screen.getByText("Not required")).toBeInTheDocument();
  });
  it("renders requester data read-only without loading staff choices", async () => {
    auth.role = "REQUESTER"; section({ canWrite: false }); await screen.findByText("Checked router");
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Action 31" })).not.toBeInTheDocument();
    expect(api.fetchStaffOwners).not.toHaveBeenCalled();
  });
  it.each(["COMPLETED", "CANCELLED"] as const)("keeps %s read-only", async state => {
    vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [{ ...action, state }] }); section();
    await screen.findByText("Checked router"); expect(screen.queryByRole("button", { name: "Edit Action 31" })).not.toBeInTheDocument();
  });
  it("supports Admin creation on an empty legacy Ticket", async () => {
    auth.role = "ADMINISTRATOR"; vi.mocked(api.fetchActions).mockResolvedValue({ ...page, items: [], total: 0 }); section();
    await screen.findByText("No actions recorded yet"); fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    expect(screen.getByRole("heading", { name: "New Action" })).toHaveFocus();
  });
  it("paginates bounded requests", async () => {
    vi.mocked(api.fetchActions).mockResolvedValue({ ...page, total: 21 }); section(); await screen.findByText("Checked router");
    fireEvent.click(screen.getByRole("button", { name: "Next Actions" }));
    await waitFor(() => expect(api.fetchActions).toHaveBeenLastCalledWith(42, 2));
  });
  it("shows loading and safely retries a server failure", async () => {
    vi.mocked(api.fetchActions).mockRejectedValueOnce(new Error("secret")); section();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    fireEvent.click(await screen.findByRole("button", { name: "Retry Actions" }));
    await screen.findByText("Checked router"); expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
  it.each([403,404])("clears stale data on access failure %s", async status => {
    vi.mocked(api.fetchActions).mockRejectedValue(new api.ActionRequestError(status, "NOT_FOUND")); section();
    await screen.findByRole("alert"); expect(screen.queryByText("Checked router")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
  });
  it("redirects expired sessions through the existing authentication flow", async () => {
    vi.mocked(api.fetchActions).mockRejectedValue(new api.ActionRequestError(401,"UNAUTHENTICATED"));
    render(<MemoryRouter initialEntries={["/ticket"]}><Routes><Route path="/ticket" element={<ActionsTaken ticketId={42} />} /><Route path="/login" element={<p>Login target</p>} /></Routes></MemoryRouter>);
    await screen.findByText("Login target"); expect(auth.refreshUser).toHaveBeenCalled();
  });
});
describe("Action forms and retry/concurrency (AC-03/06/07/11/17/18/21/39/43)", () => {
  it("validates required fields without submitting", () => {
    form(null); save(); expect(api.createAction).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent("Review");
  });
  it("PATCHes the loaded version and editable fields", async () => {
    form(); fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Edited" } }); save();
    await waitFor(() => expect(api.updateAction).toHaveBeenCalledWith(42,31,expect.objectContaining({ version: 2, description: "Edited" })));
    expect(vi.mocked(api.updateAction).mock.calls[0][2]).not.toHaveProperty("performedByUserId");
  });
  it("retains server field errors and draft", async () => {
    vi.mocked(api.updateAction).mockRejectedValue(new api.ActionRequestError(422,"VALIDATION_ERROR",{ description: "Server field error" })); form(); save();
    await screen.findByText("Server field error"); expect(screen.getByLabelText("Description (required)")).toHaveValue("Checked router");
  });
  it("requires explicit review after stale update without silently resubmitting", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ActionRequestError(409,"STALE_UPDATE")); form();
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "My draft" } }); save();
    fireEvent.click(await screen.findByRole("button", { name: "Reload latest Action" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use reviewed version" }));
    expect(api.updateAction).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("Description (required)")).toHaveValue("My draft"); save();
    await waitFor(() => expect(api.updateAction).toHaveBeenLastCalledWith(42,31,expect.objectContaining({ description: "My draft", version: 3 })));
  });
  it("does not offer version adoption when reloaded Action is terminal", async () => {
    vi.mocked(api.updateAction).mockRejectedValue(new api.ActionRequestError(409,"STALE_UPDATE")); form(action, vi.fn().mockResolvedValue({ ...action, version: 3, state: "COMPLETED" })); save();
    fireEvent.click(await screen.findByRole("button", { name: "Reload latest Action" }));
    await screen.findByText(/now read-only/); expect(screen.queryByRole("button", { name: "Use reviewed version" })).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled();
  });
  it("retries an ambiguous create with identical key and payload", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new TypeError("network")); form(null);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Original" } }); save();
    fireEvent.click(await screen.findByRole("button", { name: "Retry original request" }));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.createAction).mock.calls[1]).toEqual(vi.mocked(api.createAction).mock.calls[0]);
  });
  it("prevents double submissions while pending", async () => {
    let finish!: (value: { action: api.ActionTaken }) => void;
    vi.mocked(api.updateAction).mockReturnValue(new Promise(resolve => { finish = resolve; })); const { success } = form(); const button = screen.getByRole("button", { name: "Save Action" }); fireEvent.click(button); fireEvent.click(button);
    expect(api.updateAction).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ action }); await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  });
  it("refreshes eligibility on inactive-assignee rejection", async () => {
    vi.mocked(api.updateAction).mockRejectedValue(new api.ActionRequestError(422,"INACTIVE_ASSIGNEE",{ assignedToUserId: "Choose active staff" })); const { refreshOwners } = form(); save();
    await screen.findByText("Choose active staff"); expect(refreshOwners).toHaveBeenCalled();
  });
  it.each(["IDEMPOTENCY_KEY_EXPIRED", "IDEMPOTENCY_CONFLICT"])("requires review instead of rotating a conflicted key (%s)", async code => {
    vi.mocked(api.createAction).mockRejectedValue(new api.ActionRequestError(409,code)); form(null);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Original" } }); save();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled()); expect(api.createAction).toHaveBeenCalledTimes(1);
  });
  it("locates a moved conflicted Action across pages without discarding fields or adopting its version", async () => {
    let moved = false;
    vi.mocked(api.fetchActions).mockImplementation(async (_ticket, requested) => !moved ? { ...page, total: 21 } :
      { ...page, page: requested ?? 1, total: 21, items: requested === 2 ? [{ ...action, version: 3 }] : [] });
    vi.mocked(api.updateAction).mockImplementation(async () => { moved = true; throw new api.ActionRequestError(409,"STALE_UPDATE"); });
    section(); fireEvent.click(await screen.findByRole("button", { name: "Edit Action 31" }));
    for (const [label, value] of [["Description (required)","My draft"],["Result","My result"],["Follow-Up Note (required)","My follow-up"],["Attachment Notes","My attachment"]])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const time = (screen.getByLabelText(/Action Date\/Time \(required/) as HTMLInputElement).value;
    save(); fireEvent.click(await screen.findByRole("button", { name: "Reload latest Action" }));
    await screen.findByRole("button", { name: "Use reviewed version" });
    expect(api.fetchActions).toHaveBeenCalledWith(42,2); expect(api.updateAction).toHaveBeenCalledTimes(1);
    for (const [label, value] of [["Description (required)","My draft"],["Result","My result"],["Follow-Up Note (required)","My follow-up"],["Attachment Notes","My attachment"]]) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(screen.getByLabelText(/Action Date\/Time \(required/)).toHaveValue(time);
    expect(screen.getByLabelText("Assigned To")).toHaveValue("8");
    expect(screen.getByLabelText("Follow-Up Required")).toBeChecked();
    expect(screen.getByLabelText("State")).toHaveValue("PLANNED");
    expect(screen.getByText(/Ticket 42 · Version 2/)).toBeInTheDocument();
  });
  it("requires explicit state selection when review advances Planned to In Progress", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ActionRequestError(409,"STALE_UPDATE"));
    form(action, vi.fn().mockResolvedValue({ ...action, version: 3, state: "IN_PROGRESS" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "My draft" } }); save();
    fireEvent.click(await screen.findByRole("button", { name: "Reload latest Action" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use reviewed version" }));
    expect(screen.getByLabelText("State")).toHaveValue("PLANNED");
    expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled();
    expect(screen.getByLabelText("Description (required)")).toHaveValue("My draft");
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "IN_PROGRESS" } }); save();
    await waitFor(() => expect(api.updateAction).toHaveBeenLastCalledWith(42,31,{ description: "My draft", state: "IN_PROGRESS", version: 3 }));
  });
  it("rejects an assignee removed by an eligibility refresh until explicitly cleared", async () => {
    const props = { ticketId: 42, action, performer: staff.name, onCancel: vi.fn(), onSuccess: vi.fn(), onFailure: vi.fn(), onReload: vi.fn(), refreshOwners: vi.fn() };
    const view = render(<ActionTakenForm {...props} owners={owners} />);
    view.rerender(<ActionTakenForm {...props} owners={[]} />); save();
    expect(api.updateAction).not.toHaveBeenCalled(); expect(screen.getByText(/Choose an active assignee or Unassigned/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Assigned To"), { target: { value: "" } }); save();
    await waitFor(() => expect(api.updateAction).toHaveBeenCalledWith(42,31,{ assignedToUserId: null, version: 2 }));
  });

});
