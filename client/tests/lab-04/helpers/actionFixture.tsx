import type { ActionTaken, ActionInput, AuthUser } from "../../../src/api.js";
export const staff: AuthUser = { id: 7, name: "Alex Staff", email: "staff@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false };
export const action: ActionTaken = { id: 31, ticketId: 42, actionAt: "2026-10-22T10:30:00.000Z", description: "Checked router", result: "Working",
  performedBy: { id: 7, name: "Alex Staff" }, assignedTo: { id: 8, name: "Priya Staff" }, followUpRequired: true, followUpNote: "Check tomorrow",
  attachmentNotes: "See Ticket photo", state: "PLANNED", version: 2, createdAt: "2026-10-22T10:30:00.000Z", updatedAt: "2026-10-22T10:35:00.000Z" };
export const body: ActionInput = { actionAt: action.actionAt, description: action.description, result: action.result, assignedToUserId: 8,
  followUpRequired: true, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes, state: "PLANNED" };
export const owners = [{ id: 8, name: "Priya Staff", email: "staff2@example.test", role: "IT_STAFF" as const }];
export const page = { items: [action], page: 1, pageSize: 20, total: 1 };
