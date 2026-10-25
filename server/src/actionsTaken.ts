import { Router, ErrorRequestHandler, Response } from "express";
import { AuthenticatedRequest, requireAuth, requirePasswordChanged, requireRole, requireSameOrigin } from "./auth.js";
import { createAction, listActions, updateAction, satisfyFollowUp } from "./actionTakenService.js";
import { ActionError, actionPathId, actionPagination, validateActionBody, idempotencyKey, actionPayloadHash, positiveInt } from "./validateActionTaken.js";

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

actionsTaken.post("/:actionId/follow-up-resolution", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = actionPathId(req.params.ticketId, "ticketId");
    const actionId = actionPathId(req.params.actionId, "actionId");
    const input = req.body;
    const fields: Record<string, string> = {};
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ActionError(422, "VALIDATION_ERROR", { body: "Supply a JSON object." });
    for (const key of Object.keys(input)) if (!["version", "outcome"].includes(key)) fields[key] = "Field is not editable.";
    if (!positiveInt(input.version)) fields.version = "Supply the current positive integer version.";
    if (typeof input.outcome !== "string" || !input.outcome.trim()) fields.outcome = "Record a nonblank follow-up outcome.";
    if (Object.keys(fields).length) throw new ActionError(422, "VALIDATION_ERROR", fields);
    const result = await satisfyFollowUp(req, ticketId, actionId, input.version, input.outcome);
    res.status(result.status).json(result.body);
  } catch (error) { failure(res, error); }
});

// Scoped to Action paths: preserve legacy parser/error behavior elsewhere.
export const actionBodyError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "VALIDATION_ERROR", fields: { body: "Supply valid JSON." } });
  } else next(error);
};
