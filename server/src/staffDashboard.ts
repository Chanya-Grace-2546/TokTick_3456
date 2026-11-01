import { Router } from "express";
import { Prisma, Priority, TicketStatus } from "@prisma/client";
import { AuthenticatedRequest, requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { openTickets, ticketsWithMyActions, recentTicketWindow } from "./staffTicketFilters.js";
export const staffDashboard = Router();
staffDashboard.get("/", requireAuth, requirePasswordChanged, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getPrisma().$transaction(async tx => {
      const asOf = new Date(), userId = req.authUser!.id;
      const [unassignedTickets, myOwnedTickets, assignedTickets, urgentOpenTickets, statuses, priorities, recent] = await Promise.all([
        tx.ticket.count({ where: { AND: [openTickets(), { ownerId: null }] } }),
        tx.ticket.count({ where: { AND: [openTickets(), { ownerId: userId }] } }),
        tx.ticket.count({ where: ticketsWithMyActions(userId) }),
        tx.ticket.count({ where: { AND: [openTickets(), { itPriority: "HIGH" }] } }),
        tx.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
        tx.ticket.groupBy({ by: ["itPriority"], _count: { _all: true } }),
        tx.ticket.findMany({ where: { updatedAt: recentTicketWindow(asOf) }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5,
          select: { id: true, ticketNumber: true, summary: true, status: true, updatedAt: true } }),
      ]);
      return { asOf, metrics: { unassignedTickets, myOwnedTickets, ticketsWithMyActions: assignedTickets, urgentOpenTickets },
        byStatus: Object.fromEntries(Object.values(TicketStatus).map(status => [status, statuses.find(row => row.status === status)?._count._all ?? 0])),
        byPriority: Object.values(Priority).map(priority => ({ priority, count: priorities.find(row => row.itPriority === priority)?._count._all ?? 0 })),
        recentTickets: recent.map(ticket => ({ ...ticket, href: `/staff/tickets/${ticket.id}` })),
        drillDown: { unassignedTickets: "/staff/tickets?owner=unassigned&statusGroup=open", myOwnedTickets: "/staff/tickets?owner=me&statusGroup=open", ticketsWithMyActions: "/staff/tickets?myAction=true", urgentOpenTickets: "/staff/tickets?itPriority=HIGH&statusGroup=open" } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json(result);
  } catch { console.error("Staff dashboard could not be loaded."); res.status(500).json({ error: "UNEXPECTED_ERROR" }); }
});
