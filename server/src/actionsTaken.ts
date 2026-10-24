import { Router, ErrorRequestHandler, Response } from "express";
import { AuthenticatedRequest, requireAuth, requirePasswordChanged, requireRole, requireSameOrigin } from "./auth.js";
import { createAction, listActions, updateAction } from "./actionTakenService.js";
import { ActionError, actionPathId, actionPagination, validateActionBody, idempotencyKey, actionPayloadHash } from "./validateActionTaken.js";

function failure(res: Response, error: unknown) {
  if (error instanceof ActionError) {
    res.status(error.status).json({ error: error.code, ...(error.fields ? { fields: error.fields } : {}) });
  } else {
    // Log a fixed context only: Prisma exceptions can embed request data/SQL.
    console.error("Actions Taken operation failed.");
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
}

export const actionsTaken = Router({ mergeParams: true });
actionsTaken.use(requireAuth, requirePasswordChanged, requireSameOrigin);
actionsTaken.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = actionPathId(req.params.ticketId, "ticketId");
    const { page, pageSize, skip } = actionPagination(req.query);
    res.json(await listActions(req.authUser!, ticketId, page, pageSize, skip));
  } catch (error) { failure(res, error); }
});
actionsTaken.post("/", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = actionPathId(req.params.ticketId, "ticketId");
    const { data } = validateActionBody(req.body, false);
    const key = idempotencyKey(req.get("Idempotency-Key"));
    const result = await createAction(req, ticketId, data, key, actionPayloadHash(req.body));
    res.status(result.status).json(result.body);
  } catch (error) { failure(res, error); }
});
actionsTaken.patch("/:actionId", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = actionPathId(req.params.ticketId, "ticketId");
    const actionId = actionPathId(req.params.actionId, "actionId");
    const { data, version } = validateActionBody(req.body, true);
    res.json(await updateAction(req, ticketId, actionId, data, version!));
  } catch (error) { failure(res, error); }
});

// Scoped to Action paths: preserve legacy parser/error behavior elsewhere.
export const actionBodyError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "VALIDATION_ERROR", fields: { body: "Supply valid JSON." } });
  } else next(error);
};
