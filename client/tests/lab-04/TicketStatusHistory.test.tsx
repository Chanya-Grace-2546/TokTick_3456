import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TicketStatusHistory from "../../src/components/TicketStatusHistory.js";
import * as api from "../../src/api.js";
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }));
vi.mock("../../src/api.js", async original => ({ ...await original<typeof import("../../src/api.js")>(), fetchTicketStatusHistory: vi.fn() }));
const event = { id: 3, oldStatus: "OPEN", newStatus: "IN_PROGRESS", actor: { name: "Staff Person", role: "IT_STAFF" }, occurredAt: "2026-11-01T03:00:00.000Z" };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue({ items: [] }); });
const show = () => render(<MemoryRouter><TicketStatusHistory ticketId={42} /></MemoryRouter>);
it("announces loading and the empty state", async () => { show(); expect(screen.getByRole("status")).toHaveTextContent("Loading"); await screen.findByText("No recorded status transitions."); });
it("shows ordered readable transitions, actor and exact datetime without mutation controls", async () => {
 vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue({ items: [event, { ...event, id: 2, newStatus: "OPEN", oldStatus: "NEW" }] });show();
 await screen.findByRole("list");expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Open → In Progress");expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("New → Open");
 expect(screen.getAllByText("Staff Person")).toHaveLength(2);expect(screen.getAllByText(/01\/11\/2026, 10:00:00/)[0]).toHaveAttribute("datetime", event.occurredAt);expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("shows a safe error and retries", async () => { vi.mocked(api.fetchTicketStatusHistory).mockRejectedValueOnce(new Error("PRIVATE SQL"));show();await screen.findByRole("alert");expect(screen.queryByText("PRIVATE SQL")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button", { name: "Retry history" }));await screen.findByText("No recorded status transitions."); });
it.each([403,404])("clears old history on access failure %s", async status => {
 vi.mocked(api.fetchTicketStatusHistory).mockResolvedValueOnce({ items: [event] });const view=show();await screen.findByRole("list");vi.mocked(api.fetchTicketStatusHistory).mockRejectedValue(new api.ActionRequestError(status,"NOT_FOUND"));view.rerender(<MemoryRouter><TicketStatusHistory ticketId={43} /></MemoryRouter>);await screen.findByRole("alert");expect(screen.queryByText("Staff Person")).not.toBeInTheDocument();
});
it("refreshes after a Ticket workflow change",async()=>{const view=show();await screen.findByText("No recorded status transitions.");vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue({items:[event]});view.rerender(<MemoryRouter><TicketStatusHistory ticketId={42} refreshKey={1}/></MemoryRouter>);await screen.findByRole("list");await waitFor(()=>expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(2));});
