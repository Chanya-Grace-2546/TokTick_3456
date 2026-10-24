import { ActionState } from "@prisma/client";

const transitions: Record<ActionState, readonly ActionState[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isTerminalAction(state: ActionState): boolean {
  return state === "COMPLETED" || state === "CANCELLED";
}

// An unchanged state is a permitted edit only while the Action is nonterminal.
export function canUpdateActionState(from: ActionState, to: ActionState): boolean {
  return !isTerminalAction(from) && (from === to || transitions[from].includes(to));
}
