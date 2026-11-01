import { Prisma, TicketStatus } from "@prisma/client";
export const OPEN_TICKET_STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
export const openTickets = (): Prisma.TicketWhereInput => ({ status: { in: OPEN_TICKET_STATUSES } });
export const ticketsWithMyActions = (userId: number): Prisma.TicketWhereInput => ({ actionsTaken: { some: { assignedToUserId: userId, state: { in: ["PLANNED", "IN_PROGRESS"] } } } });
export function recentTicketWindow(asOf: Date) { return { gte: new Date(asOf.getTime() - 7 * 86400000), lte: asOf }; }
