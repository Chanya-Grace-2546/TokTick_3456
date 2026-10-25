import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import TicketDetail from "../../src/pages/TicketDetail.js";
import { action, owners, page, staff } from "./helpers/actionFixture.js";
const auth = vi.hoisted(() => ({ role: "IT_STAFF", refreshUser: vi.fn() }));
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ user: { ...staff, role: auth.role }, refreshUser: auth.refreshUser }) }));
const detail = { id: 42, ticketNumber: "TKT-42", summary: "Existing Wi-Fi Ticket", description: "Original Ticket description",
  requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN", currentStatus: "OPEN", requesterId: 9,
  requesterResolvedAt: null, requesterResolvedById: null, createdAt: action.createdAt, updatedAt: action.updatedAt,
  requester: { id: 9, name: "Requester", email: "requester@example.test" }, category: { id: 1, name: "Network" },
  relatedSystem: { id: 1, name: "Wi-Fi" }, owner: owners[0], attachments: [],
  publicComments: [{ id: 1, content: "Existing public comment", author: staff, createdAt: action.createdAt }],
  internalNotes: [{ id: 1, content: "Existing private note", author: staff, createdAt: action.createdAt }] };
let fetcher: ReturnType<typeof vi.fn>;
let postStatus = 0, patchStatus = 0, actionGetStatus = 0, summaryStatus = 0;
let posted = false, inactive = false;
beforeEach(() => {
  auth.role = "IT_STAFF"; postStatus = 0; patchStatus = 0; actionGetStatus = 0; summaryStatus = 0; posted = false; inactive = false;
  fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    let body: unknown;
    if (path === "/api/staff/owners") body = inactive ? [] : owners;
    else if (path === "/api/staff/tickets/42") {
      if (posted && summaryStatus) return new Response(JSON.stringify({ error: "UNEXPECTED_ERROR" }), { status: summaryStatus });
      body = detail;
    }
    else if (path.startsWith("/api/staff/tickets/42/")) body = { id: 42, owner: owners[0], itPriority: "LOW", status: "IN_PROGRESS", ownerId: 8 };
    else if (path === "/api/tickets/42") body = { ...detail, category: "Network", relatedSystem: "Wi-Fi" };
    else if (path === "/api/tickets/42/comments") body = init?.method === "POST" ? detail.publicComments[0] : { items: detail.publicComments };
    else if (path === "/api/tickets/42/internal-notes") body = detail.internalNotes[0];
    else if (path === "/api/tickets/42/actions/31") {
      if (patchStatus) return new Response(JSON.stringify({ error: patchStatus === 409 ? "STALE_UPDATE" : "FORBIDDEN" }), { status: patchStatus });
      body = { action };
    }
    else if (path === "/api/tickets/42/actions") {
      if (init?.method === "POST") {
        posted = true;
        if (postStatus) return new Response(JSON.stringify({ error: postStatus === 422 ? "INACTIVE_ASSIGNEE" : postStatus === 403 ? "FORBIDDEN" : "UNEXPECTED_ERROR", fields: postStatus === 422 ? { assignedToUserId: "Choose active staff" } : {} }), { status: postStatus });
        body = { action };
      } else {
        if (actionGetStatus) return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: actionGetStatus });
        body = page;
      }
    }
    else throw new Error(`Unexpected integration URL ${path}`);
    return new Response(JSON.stringify(body), { status: init?.method === "POST" ? 201 : 200 });
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
function renderDetail(requester = false) {
  return render(<MemoryRouter initialEntries={[requester ? "/tickets/42" : "/staff/tickets/42"]}><Routes>
    <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} /><Route path="/tickets/:id" element={<TicketDetail />} />
  </Routes></MemoryRouter>);
}
describe("Ticket Detail Actions integration (AC-15/22/33/42)", () => {
  it("keeps staff Ticket, comments, private notes and assignment controls alongside Actions", async () => {
    renderDetail(); await screen.findByText("Checked router");
    expect(screen.getByText("Existing public comment")).toBeInTheDocument();
    expect(screen.getByText("Existing private note")).toBeInTheDocument();
    expect(screen.getByText("Original Ticket description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Action" })).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/api/staff/owners"))).toHaveLength(1);
  });
  it("refreshes Actions and Ticket summary after creating an Action", async () => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "New work" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" })); await screen.findByText("Action saved.");
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/api/staff/tickets/42"))).toHaveLength(2));
    expect(fetcher.mock.calls.filter(([url, init]) => String(url).includes("/actions") && init?.method === "GET")).toHaveLength(2);
  });
  it("keeps requester comments/advisory behavior and never requests assignment choices or private notes", async () => {
    auth.role = "REQUESTER"; renderDetail(true); await screen.findByText("Checked router");
    expect(screen.getByText("Existing public comment")).toBeInTheDocument();
    expect(screen.queryByText("Existing private note")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/staff/"))).toBe(false);
  });
  async function ticketOperation(kind: string) {
    if (kind === "comment") {
      fireEvent.change(screen.getByLabelText("Add Public Comment"), { target: { value: "Preserve my Action" } });
      fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    } else if (kind === "note") {
      fireEvent.change(screen.getByLabelText("Add Internal Note"), { target: { value: "Private operational note" } });
      fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    } else {
      const controls: Record<string, [string,string,string]> = {
        owner: ["staff-owner", "", "Save / Reassign"], priority: ["staff-it-priority", "LOW", "Save IT Priority"], status: ["staff-status", "IN_PROGRESS", "Change Status"],
      };
      const [id, value, button] = controls[kind];
      fireEvent.change(document.getElementById(id)!, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: button }));
    }
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/staff/tickets/42")).toHaveLength(2));
    // Wait for the refreshed response to reach the UI.
    await waitFor(() => expect(screen.getByLabelText("Add Public Comment")).toBeEnabled());
  }
  it.each(["comment","note","owner","priority","status"])("retains create drafts through successful Ticket %s operations", async kind => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Unsaved Action" } });
    fireEvent.change(screen.getByLabelText("Attachment Notes"), { target: { value: "Unsaved attachment note" } });
    await ticketOperation(kind);
    expect(screen.getByRole("heading", { name: "New Action" })).toBeInTheDocument();
    expect(screen.getByLabelText("Description (required)")).toHaveValue("Unsaved Action");
    expect(screen.getByLabelText("Attachment Notes")).toHaveValue("Unsaved attachment note");
  });
  it.each([false,true])("retains edit drafts and stale recovery through a Ticket comment (stale=%s)", async stale => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Edit Action 31" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "My edit" } });
    if (stale) { patchStatus = 409; fireEvent.click(screen.getByRole("button", { name: "Save Action" })); await screen.findByRole("button", { name: "Reload latest Action" }); }
    await ticketOperation("comment");
    expect(screen.getByLabelText("Description (required)")).toHaveValue("My edit");
    if (stale) { expect(screen.getByRole("button", { name: "Reload latest Action" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled(); }
  });
  it("retains the frozen POST key/body across a successful Internal Note and explicit retry", async () => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Original attempt" } });
    postStatus = 500; fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByRole("button", { name: "Retry original request" });
    await ticketOperation("note"); postStatus = 0;
    fireEvent.click(screen.getByRole("button", { name: "Retry original request" })); await screen.findByText("Action saved.");
    const posts = fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/tickets/42/actions" && init?.method === "POST");
    expect(posts).toHaveLength(2); expect(posts[1][1].body).toBe(posts[0][1].body); expect(posts[1][1].headers).toEqual(posts[0][1].headers);
  });
  it.each(["list","summary"])("reports a saved mutation separately from a failed %s refresh", async target => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Saved work" } });
    if (target === "list") actionGetStatus = 500; else summaryStatus = 500;
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByText(target === "list" ? /Action saved, but the list/ : /Action saved, but the Ticket summary/);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
  it("preserves the draft during inactive assignment recovery and allows explicit clearing", async () => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Draft survives" } });
    fireEvent.change(screen.getByLabelText("Assigned To"), { target: { value: "8" } });
    inactive = true; postStatus = 422; fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByText(/no longer eligible/);
    expect(screen.getByLabelText("Description (required)")).toHaveValue("Draft survives");
    postStatus = 0; fireEvent.change(screen.getByLabelText("Assigned To"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" })); await screen.findByText("Action saved.");
  });
  it.each(["write","conflict reload"])("clears protected Action data after authorization fails during %s", async stage => {
    renderDetail(); fireEvent.click(await screen.findByRole("button", { name: "Edit Action 31" }));
    patchStatus = stage === "write" ? 403 : 409;
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    if (stage === "conflict reload") {
      const reload = await screen.findByRole("button", { name: "Reload latest Action" }); actionGetStatus = 403; fireEvent.click(reload);
    }
    await screen.findByText("You do not have permission to view these Actions.");
    expect(screen.queryByLabelText("Description (required)")).not.toBeInTheDocument();
    expect(screen.queryByText("Checked router")).not.toBeInTheDocument();
  });

});
