import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { validateCreateTicket } from "./validateCreateTicket.js";
import { createTicketWithGeneratedNumber } from "./ticketNumber.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.


// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  // TODO(Issue 2): replace this stub with the required 200 response.
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// TODO(Issue 4): implement the route here.
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Failed to load categories" });
  }
});
// ---------------------------------------------------------------------------
// Lab 2 Issue 2 — Development Requester Context
// GET /api/requesters -> active Development Requesters only (BR-05).
// This selector is a Lab 2 testing mechanism, not authentication.
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().developmentRequester.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Failed to load development requesters" });
  }
});
// ---------------------------------------------------------------------------
// Lab 2 Issue 3 — Ticket Database and Reference Data
// GET /api/related-systems -> reference data for the Create Ticket dropdown
// (FR-13). No active/inactive concept for RelatedSystem in Lab 2 — all rows
// returned, matching how /api/categories already behaves.
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json({ error: "Failed to load related systems" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Issue 4 — Ticket Creation
// POST /api/tickets -> validate, verify the Requester is active, generate
// the official Ticket Number (BR-01), and create the Ticket.
// requesterId travels in the request body per api-spec.md §4, not a header.
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  const errors = validateCreateTicket(req.body);
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: "VALIDATION_FAILED", fields: errors });
    return;
  }

  const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } =
    req.body as {
      requesterId: number;
      categoryId: number;
      relatedSystemId: number;
      summary: string;
      description: string;
      requestedPriority: "LOW" | "MEDIUM" | "HIGH";
    };

  const prisma = getPrisma();

  try {
    // BR-05: only an active Development Requester may create tickets.
    const requester = await prisma.developmentRequester.findUnique({
      where: { id: requesterId },
      select: { isActive: true },
    });
    if (!requester || !requester.isActive) {
      res.status(404).json({ error: "REQUESTER_NOT_FOUND" });
      return;
    }

    // Category / Related System must reference real rows (BR-16).
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findUnique({ where: { id: categoryId } }),
      prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } }),
    ]);
    if (!category) {
      res.status(400).json({ error: "VALIDATION_FAILED", fields: { categoryId: "Unknown Category" } });
      return;
    }
    if (!relatedSystem) {
      res.status(400).json({
        error: "VALIDATION_FAILED",
        fields: { relatedSystemId: "Unknown Related System" },
      });
      return;
    }

    // BR-18: reject an identical resubmission (same Requester, Summary,
    // Description) received within 5 seconds of the prior one.
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await prisma.ticket.findFirst({
      where: {
        requesterId,
        summary: summary.trim(),
        description: description.trim(),
        createdAt: { gte: fiveSecondsAgo },
      },
    });
    if (recentDuplicate) {
      res.status(200).json(recentDuplicate);
      return;
    }

    const ticket = await createTicketWithGeneratedNumber({
      requesterId,
      categoryId,
      relatedSystemId,
      summary: summary.trim(),
      description: description.trim(),
      requestedPriority,
      status: "NEW",
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("Failed to create ticket:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});

export default app;
