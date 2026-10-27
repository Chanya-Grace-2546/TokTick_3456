import { Router } from "express";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest, requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { openTickets, recentTicketWindow } from "./staffTicketFilters.js";
export const requesterDashboard = Router();
requesterDashboard.get("/",requireAuth,requirePasswordChanged,requireRole("REQUESTER"),async (req:AuthenticatedRequest,res)=>{
  try {
    const result = await getPrisma().$transaction(async tx=>{
      const asOf = new Date(), requesterId = req.authUser!.id;
      const own = { requesterId }, recent = { requesterId, updatedAt:recentTicketWindow(asOf) };
      const select = { id:true,ticketNumber:true,summary:true,status:true,updatedAt:true } as const;
      const [open,waiting,recentlyUpdated,recentlyResolved] = await Promise.all([
        tx.ticket.count({where:{AND:[own,openTickets()]}}),
        tx.ticket.count({where:{requesterId,status:"WAITING_FOR_REQUESTER"}}),
        tx.ticket.findMany({where:recent,select,orderBy:[{updatedAt:"desc"},{id:"desc"}],take:5}),
        tx.ticket.findMany({where:{...recent,status:"RESOLVED"},select,orderBy:[{updatedAt:"desc"},{id:"desc"}],take:5}),
      ]);
      const resource = (ticket:typeof recentlyUpdated[number])=>({...ticket,href:`/tickets/${ticket.id}`});
      return { asOf,recentWindowDays:7,metrics:{openTickets:open,waitingForRequester:waiting},recentlyUpdated:recentlyUpdated.map(resource),recentlyResolved:recentlyResolved.map(resource),
        drillDown:{openTickets:"/tickets?statusGroup=open",waitingForRequester:"/tickets?status=WAITING_FOR_REQUESTER"} };
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
    res.json(result);
  } catch { console.error("Requester dashboard could not be loaded.");res.status(500).json({error:"UNEXPECTED_ERROR"}); }
});
