import { Router } from "express";
import { AuthenticatedRequest, requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { actionPathId, ActionError } from "./validateActionTaken.js";
export const ticketStatusHistory = Router({ mergeParams: true });
ticketStatusHistory.get("/", requireAuth, requirePasswordChanged, requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"), async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = actionPathId(req.params.ticketId, "ticketId");
    const ticket = await getPrisma().ticket.findFirst({ where: { id: ticketId,
      ...(req.authUser!.role === "REQUESTER" ? { requesterId: req.authUser!.id } : {}) }, select: { id: true } });
    if (!ticket) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    const items = await getPrisma().ticketStatusHistory.findMany({ where: { ticketId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: { id: true, oldStatus: true, newStatus: true, occurredAt: true, actor: { select: { name: true, role: true } } } });
    res.json({ items });
  } catch (error) {
    if (error instanceof ActionError) res.status(error.status).json({ error: error.code });
    else res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});
