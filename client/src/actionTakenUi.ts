import { ActionInput, ActionState, ActionTaken, FieldErrors } from "./api.js";
export const actionLabels: Record<ActionState, string> = { PLANNED: "Planned", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const terminalAction = (state: ActionState) => state === "COMPLETED" || state === "CANCELLED";
export function actionStates(state?: ActionState): ActionState[] {
  if (!state) return ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  return terminalAction(state) ? [state] : state === "IN_PROGRESS" ? [state, "COMPLETED", "CANCELLED"] : [state, "IN_PROGRESS", "COMPLETED", "CANCELLED"];
}
export function localActionTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}
export interface ActionDraft { actionAt: string; description: string; result: string; assignedToUserId: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string; state: ActionState }
export function actionDraft(action?: ActionTaken): ActionDraft {
  return { actionAt: localActionTime(action?.actionAt ?? new Date().toISOString()), description: action?.description ?? "", result: action?.result ?? "",
    assignedToUserId: action?.assignedTo ? String(action.assignedTo.id) : "", followUpRequired: action?.followUpRequired ?? false,
    followUpNote: action?.followUpNote ?? "", attachmentNotes: action?.attachmentNotes ?? "", state: action?.state ?? "PLANNED" };
}
export function validateActionDraft(draft: ActionDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.description.trim()) errors.description = "Description is required.";
  if (!draft.actionAt || !Number.isFinite(new Date(draft.actionAt).getTime())) errors.actionAt = "Enter a valid local date and time.";
  if (draft.result.length > 2000) errors.result = "Result must not exceed 2000 characters.";
  if (draft.state === "COMPLETED" && !draft.result.trim()) errors.result = "Result is required when completing an Action.";
  if (draft.followUpRequired && !draft.followUpNote.trim()) errors.followUpNote = "Required when follow-up is enabled.";
  return errors;
}
export function actionInput(draft: ActionDraft): ActionInput {
  return { ...draft, actionAt: new Date(draft.actionAt).toISOString(), assignedToUserId: draft.assignedToUserId ? Number(draft.assignedToUserId) : null,
    result: draft.result || null, followUpNote: draft.followUpNote || null, attachmentNotes: draft.attachmentNotes || null };
}

// Send only user changes. In particular an unrelated edit must not rewrite time
// or overwrite fields changed by someone else while a conflict is reviewed.
export function actionPatch(draft: ActionDraft, original: ActionTaken): Partial<ActionInput> {
  const initial = actionDraft(original);
  const values = actionInput(draft);
  return Object.fromEntries((Object.keys(draft) as (keyof ActionDraft)[])
    .filter(key => draft[key] !== initial[key]).map(key => [key, values[key]])) as Partial<ActionInput>;
}

export const ticketActionsReadOnly = (status?: string) => !!status && ["RESOLVED", "CLOSED", "CANCELLED"].includes(status);
