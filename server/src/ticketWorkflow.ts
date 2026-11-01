import { TicketStatus } from "@prisma/client";
import { AuthenticatedRequest } from "./auth.js";
import { canTransitionTicketStatus, isTicketStatus } from "./statusTransitions.js";
import { ActionError } from "./validateActionTaken.js";
import { lockTicket, mutation, writer, snapshot, resolutionsFor } from "./actionTakenService.js";

export function validateTicketTransition(body: unknown): { status: TicketStatus; expectedStatus?: TicketStatus } {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!isTicketStatus(input.status)) throw new ActionError(400, "VALIDATION_FAILED", { status: "Choose a valid Ticket status." });
  if (input.expectedStatus !== undefined && !isTicketStatus(input.expectedStatus)) throw new ActionError(400, "VALIDATION_FAILED", { expectedStatus: "Choose a valid expected Ticket status." });
  return { status: input.status, expectedStatus: input.expectedStatus as TicketStatus | undefined };
}
export function resolutionBlocked(actions: { state: string; followUpRequired: boolean; satisfied: boolean }[]): boolean {
  return actions.some(action => action.state !== "CANCELLED" && (action.state !== "COMPLETED" || (action.followUpRequired && !action.satisfied)));
}
export async function transitionTicket(req: AuthenticatedRequest, ticketId: number, status: TicketStatus, expectedStatus?: TicketStatus) {
  return mutation(async tx => {
    const actor = await writer(tx, req);
    const ticket = await lockTicket(tx, ticketId, true);
    if (!ticket) throw new ActionError(404, "TICKET_NOT_FOUND");
    if (expectedStatus !== undefined && ticket.status !== expectedStatus) throw new ActionError(409, "STALE_UPDATE");
    if (!canTransitionTicketStatus(ticket.status, status)) throw new ActionError(409, "INVALID_STATUS_TRANSITION");
    if (status === "RESOLVED") {
      const actions = await tx.actionTaken.findMany({ where: { ticketId } });
      const resolutions = await resolutionsFor(tx, actions);
      if (resolutionBlocked(actions.map(action => ({ ...action, satisfied: resolutions.has(action.id) })))) throw new ActionError(422, "RESOLUTION_BLOCKED");
    }
    if (status === "CANCELLED") {
      const unfinished = await tx.actionTaken.findMany({ where: { ticketId, state: { in: ["PLANNED", "IN_PROGRESS"] } }, orderBy: { id: "asc" } });
      for (const before of unfinished) {
        const after = await tx.actionTaken.update({ where: { id: before.id }, data: { state: "CANCELLED", version: { increment: 1 } } });
        await tx.actionTakenHistory.create({ data: { actionId: before.id, actorUserId: actor.id, oldState: before.state, newState: "CANCELLED", beforeJson: snapshot(before), afterJson: snapshot(after) } });
      }
    }
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: { status }, select: { id: true, status: true, ownerId: true } });
    await tx.ticketStatusHistory.create({ data: { ticketId, actorUserId: actor.id, oldStatus: ticket.status, newStatus: status } });
    return updated;
  });
}
